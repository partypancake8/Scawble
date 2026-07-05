// App.js — Scawble native root. Loads fonts + dictionary + settings, owns the
// game instance and screen routing, and derives the theme. The game logic lives
// entirely in src/core (the tested, portable engine/AI/controller).
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { View, Text, Pressable, ActivityIndicator, Animated, useColorScheme, StyleSheet, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Fredoka_400Regular, Fredoka_600SemiBold } from '@expo-google-fonts/fredoka';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { createGame } from './src/core/controller.js';
import { seedForDate } from './src/core/daily.js';
import WORDS_TEXT from './src/lexicon-data.js';
import { getTheme, FONT, FONT_SEMI } from './src/theme';
import { loadSettings, saveSettings, loadStats, recordResult } from './src/storage';
import { setHaptics } from './src/haptics';
import { SCENARIOS } from './src/core/dev/scenarios.js';

import Home from './src/screens/Home';
import Game from './src/screens/Game';
import Analysis from './src/screens/Analysis';
import Settings from './src/screens/Settings';
import Sheet from './src/ui/Sheet';
import Button from './src/ui/Button';

function AppInner() {
  const insets = useSafeAreaInsets();
  const [fontsLoaded] = useFonts({ Fredoka_400Regular, Fredoka_600SemiBold });
  const sysScheme = useColorScheme();

  const [settings, setSettings] = useState(null);
  const [stats, setStats] = useState({});
  const [screen, setScreen] = useState('home');
  const [settingsFrom, setSettingsFrom] = useState('home');
  const [game, setGame] = useState(null);
  const [review, setReview] = useState(null);
  const [finalScores, setFinalScores] = useState({ player: 0, bot: 0 });
  const [devOpen, setDevOpen] = useState(false); // hidden dev/testing scenario picker

  // dictionary: split the inlined ENABLE list once (172k words, ~fast)
  const words = useMemo(() => WORDS_TEXT.split(/\r?\n/).filter(Boolean), []);

  // smooth screen transition (fade + slide-up) instead of a hard cut
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (settings && settings.motion === 'off') { anim.setValue(1); return; }
    anim.setValue(0);
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 9, tension: 65 }).start();
  }, [screen]);

  useEffect(() => {
    (async () => {
      const s = await loadSettings();
      setSettings(s); setHaptics(s.haptics);
      setStats(await loadStats());
    })();
  }, []);

  const difficulty = settings?.difficulty || 'expert';
  const scheme = settings?.theme === 'light' ? 'light' : settings?.theme === 'dark' ? 'dark' : (sysScheme || 'light');
  const theme = getTheme(scheme);

  const persist = useCallback((next) => { setSettings(next); saveSettings(next); setHaptics(next.haptics); }, []);

  const startGame = useCallback((seed) => {
    const g = createGame(words, { seed, difficulty });
    setGame(g); setScreen('game');
  }, [words, difficulty]);

  // Dev/testing: start a game rigged to a scenario (a guaranteed bingo, a crossing
  // setup, etc.) so every feature can be demoed on demand. Opt-in via long-press.
  const startDevGame = useCallback((sc) => {
    const g = createGame(words, { seed: 'dev-' + sc.id, difficulty, rack: sc.rack, setup: sc.setup || null, autoPlay: sc.autoPlay || false });
    setGame(g); setDevOpen(false); setScreen('game');
  }, [words, difficulty]);

  const onGameOver = useCallback((rev) => {
    const scores = { ...game.state.scores }; // snapshot: game.state is mutated in place
    setReview(rev); setFinalScores(scores);
    recordResult(scores.player > scores.bot).then(setStats);
    setScreen('analysis');
  }, [game]);

  if (!fontsLoaded || !settings) {
    return (
      <View style={[styles.loading, { backgroundColor: '#F1F5EE' }]}>
        <ActivityIndicator color="#FF7A6B" />
        <Text style={{ marginTop: 12, color: '#5C6466' }}>Loading Scawble…</Text>
      </View>
    );
  }

  const setDifficulty = (d) => persist({ ...settings, difficulty: d });

  let body;
  if (screen === 'home') {
    body = (
      <Home theme={theme} difficulty={difficulty} stats={stats} loading={false}
        onSetDifficulty={setDifficulty}
        onPlayDaily={() => startGame(seedForDate(new Date()))}
        onPlayClassic={() => startGame('classic-' + Math.floor(Math.random() * 1e9).toString(36))}
        onOpenSettings={() => { setSettingsFrom('home'); setScreen('settings'); }}
        onDevMenu={() => setDevOpen(true)} />
    );
  } else if (screen === 'game') {
    body = (
      <Game key={game.state.seed}
        game={game} settings={settings} theme={theme}
        onExit={() => setScreen('home')}
        onOpenSettings={() => { setSettingsFrom('game'); setScreen('settings'); }}
        onGameOver={onGameOver} />
    );
  } else if (screen === 'analysis') {
    body = <Analysis review={review} scores={finalScores} theme={theme} onHome={() => setScreen('home')} />;
  } else if (screen === 'settings') {
    body = (
      <Settings settings={settings} difficulty={difficulty} theme={theme}
        onToggle={(k) => persist({ ...settings, [k]: !settings[k] })}
        onChange={(k, v) => persist({ ...settings, [k]: v })}
        onSetDifficulty={setDifficulty}
        onBack={() => setScreen(settingsFrom)} />
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.paper, paddingTop: Math.max(insets.top, 10), paddingBottom: insets.bottom }]}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Animated.View style={{
        flex: 1, opacity: anim,
        transform: [
          { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
          { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] }) },
        ],
      }}>
        {body}
      </Animated.View>

      {/* hidden dev/testing scenario picker (long-press the Home wordmark) */}
      <Sheet visible={devOpen} title="Dev testing" theme={theme} onClose={() => setDevOpen(false)}>
        <Text style={{ fontFamily: FONT, color: theme.muted, marginBottom: 10, textAlign: 'center' }}>Rig a game to demo the juice.</Text>
        {SCENARIOS.map((sc) => (
          <Pressable key={sc.id} onPress={() => startDevGame(sc)}
            style={{ padding: 13, borderRadius: 12, backgroundColor: theme.lineSoft, marginBottom: 8 }}>
            <Text style={{ fontFamily: FONT_SEMI, color: theme.ink, fontSize: 15 }}>{sc.name}</Text>
            <Text style={{ fontFamily: FONT, color: theme.muted, fontSize: 13 }}>{sc.desc}</Text>
          </Pressable>
        ))}
        <Button title="Close" variant="ghost" theme={theme} onPress={() => setDevOpen(false)} />
      </Sheet>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppInner />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
