import { useCallback, useEffect, useState } from "react"
import { Link, useRouter } from "expo-router"
import { ChevronRight, Play, Search } from "lucide-react-native"
import { ActivityIndicator, FlatList, Image, ImageBackground, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { fetchDiscoverHeroImage, fetchWorks, type PublicWork } from "../src/api"
import { useSession } from "../src/session"
import { colors } from "../src/theme"

const DISCOVER_HERO_IMAGE = require("../assets/discover-hero.jpg")

export default function HomeScreen() {
  const [works, setWorks] = useState<PublicWork[]>([])
  const [discoverHeroImage, setDiscoverHeroImage] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [activeGenre, setActiveGenre] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const { session } = useSession()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const loadWorks = useCallback(async (search?: string) => {
    setLoading(true)
    setError(null)
    try { setWorks(await fetchWorks(search)) } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load works") } finally { setLoading(false) }
  }, [])
  useEffect(() => {
    let active = true
    void fetchWorks()
      .then((results) => {
        if (!active) return
        setWorks(results)
        setError(null)
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Unable to load works")
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])
  useEffect(() => {
    let active = true
    void fetchDiscoverHeroImage()
      .then((imageUrl) => {
        if (active) setDiscoverHeroImage(imageUrl)
      })
      .catch((cause: unknown) => {
        if (active) console.warn(cause instanceof Error ? cause.message : "Unable to load Discover background")
      })
    return () => {
      active = false
    }
  }, [])
  const openWork = (work: PublicWork) => session ? router.push(`/work/${work.id}`) : router.push("/auth")
  const featuredWork = works[0]
  const categories = [...new Set(works.map((work) => work.genreName?.trim() || "Independent"))]
  const visibleWorks = activeGenre
    ? works.filter((work) => (work.genreName?.trim() || "Independent") === activeGenre)
    : works.slice(1)
  const firstName = session?.user.name.trim().split(/\s+/)[0] || "there"

  return (
    <FlatList
      style={styles.screen}
      data={loading || error ? [] : visibleWorks}
      keyExtractor={(work) => String(work.id)}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void loadWorks(query); void fetchDiscoverHeroImage().then(setDiscoverHeroImage).catch((cause: unknown) => console.warn(cause instanceof Error ? cause.message : "Unable to load Discover background")) }} tintColor={colors.rust} />}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View>
          <ImageBackground source={discoverHeroImage ? { uri: discoverHeroImage } : DISCOVER_HERO_IMAGE} imageStyle={styles.introHeroImage} style={[styles.introHero, { paddingTop: insets.top + 15 }]}>
            <View style={styles.topBar}>
              <Text style={styles.greeting}>Hi {firstName}!</Text>
              {session ? (
                <Link href="/(tabs)/account" style={styles.avatarLink}>
                  {session.user.image ? <Image source={{ uri: session.user.image }} style={styles.headerAvatar} /> : <Text style={styles.headerInitial}>{session.user.name.charAt(0).toUpperCase()}</Text>}
                </Link>
              ) : <Link href="/auth" style={styles.authLink}>Sign in</Link>}
            </View>
            <Text style={styles.eyebrow}>A PLACE FOR FINISHED WORK</Text>
            <Text style={styles.title}>Music made to stay with you</Text>
            <Text style={styles.helper}>{session ? "An independent archive of songs, stories, and the people behind them." : "Sign in to discover, save, and listen to works in the archive."}</Text>
            <View style={styles.searchWrap}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={() => { setActiveGenre(null); void loadWorks(query) }}
                placeholder="Works, artists, projects"
                placeholderTextColor={colors.subtle}
                returnKeyType="search"
                style={styles.search}
              />
              <Pressable accessibilityRole="button" accessibilityLabel="Search archive" onPress={() => { setActiveGenre(null); void loadWorks(query) }} style={styles.searchSubmit}>
                <Search color={colors.white} size={20} strokeWidth={2.2} />
              </Pressable>
            </View>
          </ImageBackground>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>From the archive</Text>
          </View>
          {loading ? <ActivityIndicator style={styles.center} color={colors.rust} /> : error ? (
            <View style={styles.errorState}>
              <Text style={styles.errorTitle}>The archive is taking a pause.</Text>
              <Text style={styles.errorCopy}>Check your connection or make sure the server is running, then try again.</Text>
              <Pressable onPress={() => { setLoading(true); void loadWorks(query) }} style={styles.retryButton}><Text style={styles.retryButtonText}>Try again</Text></Pressable>
            </View>
          ) : featuredWork ? (
            <Pressable onPress={() => openWork(featuredWork)} style={({ pressed }) => [styles.featured, pressed && styles.cardPressed]}>
              <View style={styles.featuredCopy}>
                <Text style={styles.featuredLabel}>FEATURED RECORD</Text>
                <Text numberOfLines={2} style={styles.featuredTitle}>{featuredWork.title}</Text>
                <Text numberOfLines={1} style={styles.featuredArtist}>{featuredWork.artist}</Text>
                <Text style={styles.featuredMeta}>{featuredWork.genreName ?? "Independent"}{featuredWork.projectTitle ? ` - ${featuredWork.projectTitle}` : ""}</Text>
                <View style={styles.listenPill}><Play color={colors.white} fill={colors.white} size={13} /><Text style={styles.listenPillText}>{session ? "LISTEN" : "SIGN IN"}</Text></View>
              </View>
              <View style={styles.featuredArtwork}>
                {featuredWork.artworkUrl ? <Image source={{ uri: featuredWork.artworkUrl }} style={styles.featuredImage} /> : <Text style={styles.featuredPlaceholder}>♪</Text>}
              </View>
            </Pressable>
          ) : <Text style={styles.empty}>No published works found.</Text>}
          {!loading && !error && categories.length > 0 ? (
            <View>
              <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Explore by genre</Text></View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryList}>
                {categories.map((category) => {
                  const categoryWork = works.find((work) => (work.genreName?.trim() || "Independent") === category)
                  const workCount = works.filter((work) => (work.genreName?.trim() || "Independent") === category).length
                  const selected = activeGenre === category
                  return (
                    <Pressable
                      key={category}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => setActiveGenre(selected ? null : category)}
                      style={[styles.categoryCard, selected && styles.categoryCardSelected]}
                    >
                      {categoryWork?.artworkUrl ? <Image source={{ uri: categoryWork.artworkUrl }} style={styles.categoryImage} /> : <View style={styles.categoryPlaceholder} />}
                      <View style={styles.categoryShade} />
                      <View style={styles.categoryCopy}>
                        <Text numberOfLines={1} style={styles.categoryTitle}>{category}</Text>
                        <Text style={styles.categoryMeta}>{workCount} {workCount === 1 ? "work" : "works"}</Text>
                      </View>
                    </Pressable>
                  )
                })}
              </ScrollView>
            </View>
          ) : null}
          {!loading && !error && visibleWorks.length > 0 ? (
            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>{activeGenre ? `${activeGenre} works` : "More to discover"}</Text>
              {activeGenre ? <Pressable accessibilityRole="button" onPress={() => setActiveGenre(null)}><Text style={styles.clearFilter}>Clear</Text></Pressable> : null}
            </View>
          ) : null}
        </View>
      }
      renderItem={({ item }) => (
        <Pressable onPress={() => openWork(item)} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
          <View style={styles.artwork}>
            {item.artworkUrl ? <Image source={{ uri: item.artworkUrl }} style={styles.artworkImage} /> : <Text style={styles.artworkText}>♪</Text>}
          </View>
          <View style={styles.cardContent}>
            <Text numberOfLines={1} style={styles.workTitle}>{item.title}</Text>
            <Text numberOfLines={1} style={styles.artist}>{item.artist}</Text>
            <Text numberOfLines={1} style={styles.meta}>{item.genreName ?? "Independent"}{item.projectTitle ? `  ·  ${item.projectTitle}` : ""}</Text>
          </View>
          <ChevronRight color={colors.subtle} size={20} />
        </Pressable>
      )}
      ListEmptyComponent={!loading && !error && activeGenre ? <Text style={styles.empty}>No works found in this genre.</Text> : null}
    />
  )
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.paper, flex: 1 },
  list: { paddingBottom: 160, paddingHorizontal: 20 },
  introHero: { marginHorizontal: -20, marginBottom: 0, paddingBottom: 15, paddingHorizontal: 20},
  introHeroImage: { opacity: 0.45},
  topBar: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 27 },
  greeting: { color: colors.ink, fontFamily: "serif", fontSize: 27, fontWeight: "700" },
  avatarLink: { alignItems: "center", backgroundColor: colors.rustSoft, borderRadius: 24, height: 44, justifyContent: "center", overflow: "hidden", width: 44 },
  headerAvatar: { borderRadius: 22, height: "100%", width: "100%" },
  headerInitial: { color: colors.rustDark, fontSize: 17, fontWeight: "700", lineHeight: 44, textAlign: "center", width: 44 },
  authLink: { backgroundColor: colors.ink, borderRadius: 20, color: colors.white, fontSize: 12, fontWeight: "700", overflow: "hidden", paddingHorizontal: 16, paddingVertical: 11 },
  eyebrow: { color: colors.rust, fontSize: 10, fontWeight: "700", letterSpacing: 2 },
  title: { color: colors.ink, fontFamily: "serif", fontSize: 32, fontWeight: "700", lineHeight: 43, marginTop: 5 },
  helper: { color: colors.muted, fontSize: 13, lineHeight: 21, marginBottom: 22, marginTop: 5, maxWidth: 250 },
  searchWrap: { alignItems: "center", backgroundColor: colors.card, borderColor: colors.line, borderRadius: 28, borderWidth: 1, elevation: 15, flexDirection: "row", minHeight: 46, paddingLeft: 20, paddingRight: 7, shadowColor: colors.ink, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8 },
  search: { color: colors.ink, flex: 1, fontSize: 13, minHeight: 52, paddingVertical: 10 },
  searchSubmit: { alignItems: "center", backgroundColor: colors.rust, borderRadius: 22, height: 42, justifyContent: "center", width: 42 },
  sectionHeading: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 14, marginTop: 14 },
  sectionTitle: { color: colors.ink, fontFamily: "serif", fontSize: 18, fontWeight: "700" },
  featured: { backgroundColor: colors.ink, borderRadius: 22, flexDirection: "row", minHeight: 110, overflow: "hidden", padding: 17, elevation: 6, shadowColor: colors.ink, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.18, shadowRadius: 8 },
  featuredCopy: { flex: 1, justifyContent: "center", paddingRight: 5, zIndex: 1 },
  featuredLabel: { color: colors.rustDark, fontSize: 9, fontWeight: "700", letterSpacing: 1.4 },
  featuredTitle: { color: colors.white, fontFamily: "serif", fontSize: 20, fontWeight: "700", lineHeight: 27, marginTop: 8 },
  featuredArtist: { color: colors.darkMuted, fontSize: 11, marginTop: 4 },
  featuredMeta: { color: colors.darkMuted, fontSize: 10, marginTop: 4 },
  listenPill: { alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.rust, borderRadius: 18, flexDirection: "row", gap: 6, marginTop: 12, minWidth: 92, paddingHorizontal: 13, paddingVertical: 6 },
  listenPillText: { color: colors.white, fontSize: 10, fontWeight: "700", textAlign: "center" },
  featuredArtwork: { alignItems: "center", alignSelf: "center", backgroundColor: colors.olive, borderRadius: 18, height: 117, justifyContent: "center", marginLeft: 7, overflow: "hidden", width: 117 },
  featuredImage: { height: "100%", width: "100%" },
  featuredPlaceholder: { color: "#E8D8C4", fontSize: 43 },
  categoryList: { gap: 12, paddingBottom: 2 },
  categoryCard: { backgroundColor: colors.olive, borderColor: "transparent", borderRadius: 17, borderWidth: 2, height: 150, justifyContent: "flex-end", overflow: "hidden", width: 132 },
  categoryCardSelected: { borderColor: colors.rust },
  categoryImage: { height: "100%", position: "absolute", width: "100%" },
  categoryPlaceholder: { ...StyleSheet.absoluteFill, backgroundColor: colors.olive },
  categoryShade: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(24, 19, 16, 0.42)" },
  categoryCopy: { padding: 11 },
  categoryTitle: { color: colors.white, fontFamily: "serif", fontSize: 14, fontWeight: "700" },
  categoryMeta: { color: colors.white, fontSize: 10, marginTop: 3 },
  clearFilter: { color: colors.rust, fontSize: 12, fontWeight: "700" },
  card: { alignItems: "center", backgroundColor: colors.card, borderRadius: 20, flexDirection: "row", marginBottom: 10, minHeight: 108, paddingHorizontal: 13, paddingVertical: 12 },
  cardPressed: { opacity: 0.50 },
  artwork: { alignItems: "center", backgroundColor: colors.rustSoft, borderRadius: 16, height: 76, justifyContent: "center", overflow: "hidden", width: 76 },
  artworkImage: { height: "100%", width: "100%" },
  artworkText: { color: colors.rust, fontSize: 28 },
  cardContent: { flex: 1, marginLeft: 13, minWidth: 0 },
  workTitle: { color: colors.ink, fontFamily: "serif", fontSize: 14, fontWeight: "700" },
  artist: { color: colors.muted, fontSize: 13, marginTop: 3 },
  meta: { color: colors.subtle, fontSize: 10, marginTop: 7 },
  center: { marginTop: 24 },
  errorState: { alignItems: "center", backgroundColor: colors.card, borderRadius: 18, paddingHorizontal: 20, paddingVertical: 25 },
  errorTitle: { color: colors.ink, fontFamily: "serif", fontSize: 20, fontWeight: "700", textAlign: "center" },
  errorCopy: { color: colors.muted, lineHeight: 20, marginTop: 8, textAlign: "center" },
  retryButton: { backgroundColor: colors.rust, borderRadius: 20, marginTop: 18, paddingHorizontal: 17, paddingVertical: 11 },
  retryButtonText: { color: colors.white, fontSize: 12, fontWeight: "700" },
  empty: { color: colors.muted, paddingVertical: 20, textAlign: "center" },
})
