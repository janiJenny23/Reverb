import { readdirSync, readFileSync } from "node:fs"
import { dirname, relative, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript"
import { describe, expect, it } from "vitest"

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const moduleRoot = resolve(projectRoot, "modules")
const appRoot = resolve(projectRoot, "app")
const libRoot = resolve(projectRoot, "lib")
const schemaPath = resolve(projectRoot, "lib/db/schema.ts")
const allowedInfrastructureDatabaseFiles = new Set([
  "lib/auth.ts",
  "lib/bootstrap-admin.ts",
  "lib/db/index.ts",
  "lib/db/schema.ts",
])
const tableOwners: Record<string, string> = {
  user: "identity",
  session: "identity",
  account: "identity",
  verification: "identity",
  genre: "genres",
  musicianProfile: "profiles",
  project: "archive",
  work: "archive",
  favorite: "library",
  report: "moderation",
  discoverHero: "discovery-content",
  outboxEvent: "admin",
}
const allowedCrossModuleReads: Record<string, readonly string[]> = {
  "modules/discovery/index.ts": ["genre", "musicianProfile", "project", "work"],
}
const allowedModuleDependencies: Record<string, readonly string[]> = {
  archive: ["genres", "identity", "profiles"],
  admin: ["archive", "genres", "identity", "library", "moderation", "profiles"],
  discovery: ["profiles"],
  library: ["archive"],
  moderation: ["archive"],
  profiles: ["identity"],
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return entry.isFile() && /\.(ts|tsx)$/.test(entry.name) ? [path] : []
  })
}

function moduleSpecifiers(filePath: string): string[] {
  const source = readFileSync(filePath, "utf8")
  const scriptKind = filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const file = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, scriptKind)
  const specifiers: string[] = []

  function visit(node: ts.Node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text)
    }

    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      specifiers.push(node.arguments[0].text)
    }

    if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteral(node.argument.literal)
    ) {
      specifiers.push(node.argument.literal.text)
    }

    ts.forEachChild(node, visit)
  }

  visit(file)
  return specifiers
}

function resolveLocalImport(importer: string, specifier: string): string | null {
  if (specifier.startsWith("@/")) return resolve(projectRoot, specifier.slice(2))
  if (specifier.startsWith(".")) return resolve(dirname(importer), specifier)
  return null
}

function withoutExtension(path: string): string {
  return path.replace(/\.[cm]?[jt]sx?$/, "")
}

function isWithin(path: string, directory: string): boolean {
  const candidate = withoutExtension(path)
  const base = withoutExtension(directory)
  return candidate === base || candidate.startsWith(`${base}${sep}`)
}

function violationsFor(
  root: string,
  isForbidden: (specifier: string, importer: string) => boolean,
): string[] {
  return sourceFiles(root).flatMap((filePath) =>
    moduleSpecifiers(filePath)
      .filter((specifier) => isForbidden(specifier, filePath))
      .map((specifier) => `${relative(projectRoot, filePath)} imports "${specifier}"`),
  )
}

function schemaTableNames(): string[] {
  const source = readFileSync(schemaPath, "utf8")
  const file = ts.createSourceFile(schemaPath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  return file.statements.flatMap((statement) => {
    if (!ts.isVariableStatement(statement) || !statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
      return []
    }
    return statement.declarationList.declarations.flatMap((declaration) => {
      if (
        !ts.isIdentifier(declaration.name) ||
        !declaration.initializer ||
        !ts.isCallExpression(declaration.initializer) ||
        !ts.isIdentifier(declaration.initializer.expression) ||
        declaration.initializer.expression.text !== "pgTable"
      ) {
        return []
      }
      return [declaration.name.text]
    })
  })
}

function importedSchemaTables(filePath: string): Map<string, string> {
  const source = readFileSync(filePath, "utf8")
  const scriptKind = filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const file = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, scriptKind)
  const tables = new Map<string, string>()

  for (const statement of file.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      !statement.importClause?.namedBindings ||
      !ts.isNamedImports(statement.importClause.namedBindings)
    ) {
      continue
    }
    const target = resolveLocalImport(filePath, statement.moduleSpecifier.text)
    if (!target || !isWithin(target, schemaPath)) continue
    for (const element of statement.importClause.namedBindings.elements) {
      const tableName = element.propertyName?.text ?? element.name.text
      if (tableName in tableOwners) tables.set(element.name.text, tableName)
    }
  }

  return tables
}

function moduleNameForFile(filePath: string): string {
  return relative(moduleRoot, filePath).split(sep)[0]
}

function moduleDependencyGraph(): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>(
    sourceFiles(moduleRoot).map((filePath) => [moduleNameForFile(filePath), new Set<string>()]),
  )

  for (const filePath of sourceFiles(moduleRoot)) {
    const sourceModule = moduleNameForFile(filePath)
    for (const specifier of moduleSpecifiers(filePath)) {
      const target = resolveLocalImport(filePath, specifier)
      if (!target || !isWithin(target, moduleRoot)) continue
      const targetModule = moduleNameForFile(target)
      if (targetModule !== sourceModule) graph.get(sourceModule)?.add(targetModule)
    }
  }

  return graph
}

function moduleCycles(graph: Map<string, Set<string>>): string[][] {
  const visited = new Set<string>()
  const active = new Set<string>()
  const path: string[] = []
  const cycles: string[][] = []

  function visit(moduleName: string) {
    if (active.has(moduleName)) {
      const cycleStart = path.indexOf(moduleName)
      cycles.push([...path.slice(cycleStart), moduleName])
      return
    }
    if (visited.has(moduleName)) return

    active.add(moduleName)
    path.push(moduleName)
    for (const dependency of graph.get(moduleName) ?? []) visit(dependency)
    path.pop()
    active.delete(moduleName)
    visited.add(moduleName)
  }

  for (const moduleName of graph.keys()) visit(moduleName)
  return cycles
}

describe("architecture boundaries", () => {
  it("keeps feature modules independent of app routes, Next.js, and session adapters", () => {
    const authAdapters = [
      resolve(projectRoot, "lib/auth"),
      resolve(projectRoot, "lib/mobile-auth"),
      resolve(projectRoot, "lib/session"),
    ]
    const violations = violationsFor(moduleRoot, (specifier, importer) => {
      if (specifier === "next" || specifier.startsWith("next/")) return true
      const target = resolveLocalImport(importer, specifier)
      return Boolean(
        target &&
          (isWithin(target, appRoot) || authAdapters.some((adapter) => isWithin(target, adapter))),
      )
    })

    expect(violations).toEqual([])
  })

  it("keeps database access out of Next.js adapters", () => {
    const databaseRoot = resolve(projectRoot, "lib/db")
    const violations = violationsFor(appRoot, (specifier, importer) => {
      if (
        specifier === "drizzle-orm" ||
        specifier.startsWith("drizzle-orm/") ||
        specifier === "pg" ||
        specifier.startsWith("pg/")
      ) {
        return true
      }
      const target = resolveLocalImport(importer, specifier)
      return Boolean(target && isWithin(target, databaseRoot))
    })

    expect(violations).toEqual([])
  })

  it("limits direct database access in lib to persistence and auth infrastructure", () => {
    const violations = violationsFor(libRoot, (specifier, importer) => {
      if (
        specifier === "drizzle-orm" ||
        specifier.startsWith("drizzle-orm/") ||
        specifier === "pg" ||
        specifier.startsWith("pg/")
      ) {
        return !allowedInfrastructureDatabaseFiles.has(relative(projectRoot, importer))
      }

      const target = resolveLocalImport(importer, specifier)
      return Boolean(
        target &&
          isWithin(target, resolve(projectRoot, "lib/db")) &&
          !allowedInfrastructureDatabaseFiles.has(relative(projectRoot, importer)),
      )
    })

    expect(violations).toEqual([])
  })

  it("keeps Discover content storage inside its owning module", () => {
    const violations = sourceFiles(moduleRoot).flatMap((filePath) => {
      const source = readFileSync(filePath, "utf8")
      const scriptKind = filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
      const file = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, scriptKind)
      const importsDiscoverHero = file.statements.some((statement) => {
        if (
          !ts.isImportDeclaration(statement) ||
          !ts.isStringLiteral(statement.moduleSpecifier) ||
          !statement.importClause?.namedBindings ||
          !ts.isNamedImports(statement.importClause.namedBindings)
        ) {
          return false
        }
        const target = resolveLocalImport(filePath, statement.moduleSpecifier.text)
        if (!target || !isWithin(target, resolve(projectRoot, "lib/db/schema"))) return false
        return statement.importClause.namedBindings.elements.some(
          (element) => element.propertyName?.text === "discoverHero" || element.name.text === "discoverHero",
        )
      })

      return importsDiscoverHero && !isWithin(filePath, resolve(moduleRoot, "discovery-content"))
        ? [`${relative(projectRoot, filePath)} imports Discover content storage`]
        : []
    })

    expect(violations).toEqual([])
  })

  it("assigns every database table to exactly one feature module", () => {
    expect(Object.keys(tableOwners).sort()).toEqual(schemaTableNames().sort())
  })

  it("keeps the Discovery read-model exception limited to its public entry point and declared tables", () => {
    expect(Object.keys(allowedCrossModuleReads)).toEqual(["modules/discovery/index.ts"])
    expect(allowedCrossModuleReads["modules/discovery/index.ts"]).toEqual([
      "genre",
      "musicianProfile",
      "project",
      "work",
    ])
  })

  it("declares cross-module table reads and prevents writes outside table ownership", () => {
    const violations = sourceFiles(moduleRoot).flatMap((filePath) => {
      const source = readFileSync(filePath, "utf8")
      const scriptKind = filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
      const file = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, scriptKind)
      const moduleName = moduleNameForFile(filePath)
      const importedTables = importedSchemaTables(filePath)
      const reported = new Set<string>()
      const errors: string[] = []

      for (const tableName of importedTables.values()) {
        if (
          tableOwners[tableName] !== moduleName &&
          !allowedCrossModuleReads[relative(projectRoot, filePath)]?.includes(tableName)
        ) {
          errors.push(`${relative(projectRoot, filePath)} reads ${tableName}, owned by ${tableOwners[tableName]}`)
        }
      }

      function visit(node: ts.Node) {
        if (
          ts.isCallExpression(node) &&
          ts.isPropertyAccessExpression(node.expression) &&
          ["delete", "insert", "update"].includes(node.expression.name.text) &&
          node.arguments[0] &&
          ts.isIdentifier(node.arguments[0])
        ) {
          const tableName = importedTables.get(node.arguments[0].text)
          if (tableName && tableOwners[tableName] !== moduleName && !reported.has(tableName)) {
            reported.add(tableName)
            errors.push(`${relative(projectRoot, filePath)} writes ${tableName}, owned by ${tableOwners[tableName]}`)
          }
        }
        ts.forEachChild(node, visit)
      }

      visit(file)
      return errors
    })

    expect(violations).toEqual([])
  })

  it("allows only explicitly declared module dependencies", () => {
    const graph = moduleDependencyGraph()
    const violations = [...graph].flatMap(([moduleName, dependencies]) =>
      [...dependencies]
        .filter((dependency) => !allowedModuleDependencies[moduleName]?.includes(dependency))
        .map((dependency) => `${moduleName} imports ${dependency} without an allowed dependency`),
    )
    for (const filePath of sourceFiles(moduleRoot)) {
      const sourceModule = moduleNameForFile(filePath)
      for (const specifier of moduleSpecifiers(filePath)) {
        const target = resolveLocalImport(filePath, specifier)
        if (!target || !isWithin(target, moduleRoot)) continue
        const targetModule = moduleNameForFile(target)
        if (targetModule === sourceModule) continue
        const publicEntry = resolve(moduleRoot, targetModule)
        if (withoutExtension(target) !== withoutExtension(publicEntry)) {
          violations.push(
            `${relative(projectRoot, filePath)} imports internal path "${specifier}" from ${targetModule}`,
          )
        }
      }
    }

    expect(violations).toEqual([])
  })

  it("keeps the module dependency graph acyclic", () => {
    expect(moduleCycles(moduleDependencyGraph())).toEqual([])
  })

  it("detects cycles in a dependency graph", () => {
    const graph = new Map([
      ["archive", new Set(["moderation"])],
      ["moderation", new Set(["admin"])],
      ["admin", new Set(["archive"])],
    ])

    expect(moduleCycles(graph)).toEqual([["archive", "moderation", "admin", "archive"]])
  })
})
