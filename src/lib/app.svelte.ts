// Application state: navigation, settings, the running game and its side effects
// (audio, sound effects, haptics, persistence). Game rules live in ./game/engine.ts.
import * as E from './game/engine';
import type { GameSettings, GameState, PlayerSetup, Song } from './game/types';
import { player } from './audio/player';
import { preloadSfx, setSfxEnabled, sfx } from './audio/sfx';
import { spotifyUrl } from './audio/sources';
import { songs, songsById } from './deckdata';
import { haptics, keepAwake, openExternal, setHaptics } from './platform';
import * as store from './storage';

export type Screen = 'home' | 'setup' | 'game' | 'rules' | 'settings' | 'history' | 'deck';

const UNDO_LIMIT = 12;

function toast(msg: string, kind: 'info' | 'warn' = 'info') {
  app.toasts = [...app.toasts, { id: Date.now() + Math.random(), msg, kind }];
}

/** The saved game, unless it refers to cards that are not in this version's deck. */
function restoreGame(): GameState | null {
  const g = store.loadGame();
  if (!g) return null;
  const phase = g.phase as { card?: string };
  const ids = [
    ...g.players.flatMap((p) => p.timeline),
    ...(g.team?.timeline ?? []),
    ...g.deck,
    ...g.discard,
    ...(phase.card ? [phase.card] : []),
  ];
  if (ids.every((id) => songsById.has(id))) return g;
  store.saveGame(null);
  return null;
}

class App {
  screen = $state<Screen>('home');
  settings = $state<store.AppSettings>(store.loadSettings());
  game = $state.raw<GameState | null>(restoreGame());
  toasts = $state<{ id: number; msg: string; kind: 'info' | 'warn' }[]>([]);
  /** Audio problem for the card being played (shown with a "draw another" button). */
  audioError = $state<string | null>(null);
  /** True while the big reveal animation is running. */
  revealing = $state(false);
  menuOpen = $state(false);
  private undoStack: GameState[] = [];
  canUndo = $state(false);
  /** History entries pushed on top of the home screen (so "home" can unwind them all). */
  private depth = 0;
  private unwinding = false;

  constructor() {
    this.applySettings();
    if (typeof window !== 'undefined') {
      history.replaceState({ screen: 'home' }, '');
      window.addEventListener('popstate', (e) => this.onPop(e.state as { screen?: Screen } | null));
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') player.pause();
      });
      // Android back button (see MainActivity): the app answers 'exit' only on the home screen.
      (window as unknown as { sifBack?: () => string }).sifBack = () => this.handleBack();
      // The first touch wakes the audio up and decodes the sound effects, so that they are
      // ready on every screen, the very first tap included. (The full unlock, which on iPhone
      // takes over the audio like a music app, waits for the game to start.)
      const firstTouch = () => {
        void player.ensureContext()?.resume().catch(() => {});
        void preloadSfx();
      };
      for (const type of ['pointerup', 'keydown']) window.addEventListener(type, firstTouch, { once: true, capture: true });
    }
  }

  // ---------------------------------------------------------------- navigation

  go(screen: Screen) {
    if (screen === this.screen) return;
    const from = this.screen;
    if (screen === 'home') {
      this.screen = 'home';
      if (this.depth > 0) {
        // Drop every screen entry, so that "back" on the home screen leaves the app.
        this.unwinding = true;
        history.go(-this.depth);
        this.depth = 0;
      }
    } else {
      history.pushState({ screen }, '');
      this.depth++;
      this.screen = screen;
    }
    if (screen === 'game' && from !== 'game') this.enterGame();
    else if (screen !== 'game') {
      this.stopMusic();
      keepAwake(false);
    }
  }

  /** Browser / Android back. In a game it toggles the pause menu instead of leaving. */
  private onPop(state: { screen?: Screen } | null) {
    if (this.unwinding) {
      this.unwinding = false; // our own history.go() back to the home screen
      return;
    }
    if (this.screen === 'game' && this.game && this.game.phase.t !== 'over') {
      history.pushState({ screen: 'game' }, '');
      this.menuOpen = !this.menuOpen;
      return;
    }
    const from = this.screen;
    this.screen = state?.screen ?? 'home';
    this.depth = this.screen === 'home' ? 0 : Math.max(0, this.depth - 1);
    if (this.screen === 'game' && from !== 'game') this.enterGame(); // back from rules / settings
    else if (this.screen !== 'game') {
      this.stopMusic();
      keepAwake(false);
    }
  }

  /** Called by the Android back button: 'exit' closes the app. */
  handleBack(): 'handled' | 'exit' {
    if (this.screen === 'home') return 'exit';
    if (this.screen === 'game' && this.game?.phase.t === 'over') this.go('home');
    else history.back();
    return 'handled';
  }

  back() {
    history.back();
  }

  private stopMusic() {
    player.stop();
  }

  // ---------------------------------------------------------------- settings

  saveSettings() {
    store.saveSettings($state.snapshot(this.settings) as store.AppSettings);
    this.applySettings();
  }

  private applySettings() {
    const s = this.settings;
    player.setMusicVolume(s.musicVolume);
    player.setFxVolume(s.sfx ? s.sfxVolume : 0);
    player.preference = s.source;
    player.autoLoop = s.autoLoop;
    setSfxEnabled(s.sfx);
    setHaptics(s.haptics);
    if (typeof document !== 'undefined') document.documentElement.dataset.motion = s.motion;
  }

  // ---------------------------------------------------------------- game lifecycle

  private set(next: GameState, undoable = true) {
    if (undoable && this.game) {
      this.undoStack.push(this.game);
      if (this.undoStack.length > UNDO_LIMIT) this.undoStack.shift();
    }
    this.game = next;
    this.canUndo = this.undoStack.length > 0;
    store.saveGame(next);
    if (next.phase.t === 'over') this.finish(next);
  }

  private guard(fn: () => void) {
    try {
      fn();
    } catch (err) {
      if (err instanceof E.RuleError) toast(err.message, 'warn');
      else throw err;
    }
  }

  newGame(players: PlayerSetup[], settings: GameSettings, firstPlayer = 0) {
    this.guard(() => {
      const g = E.newGame({ players, settings, songs, firstPlayer, freshness: store.beginGameFreshness() });
      this.undoStack = [];
      this.canUndo = false;
      this.settings.game = settings;
      this.saveSettings();
      store.saveRoster(players);
      store.markSeen(g.players.flatMap((p) => p.timeline).concat(g.team?.timeline ?? []));
      this.game = g;
      store.saveGame(g);
      this.audioError = null;
      this.menuOpen = false;
      player.unlock();
      sfx.shuffle();
      if (this.screen === 'game') this.enterGame();
      else this.go('game');
    });
  }

  resumeGame() {
    if (!this.game) return;
    player.unlock();
    this.menuOpen = false;
    this.go('game');
  }

  /** Entering (or coming back to) the game screen: screen on, music of the current card. */
  private enterGame() {
    if (this.settings.keepAwake) keepAwake(true);
    this.ensureCardMusic();
    this.preloadAhead();
  }

  /** While a card is being listened to or challenged, its song must be playing (or loading). */
  private ensureCardMusic() {
    const g = this.game;
    if (!g || (g.phase.t !== 'listen' && g.phase.t !== 'challenge')) return;
    if (this.settings.playback !== 'preview') return; // Spotify mode opens the app only on a draw
    if (player.songId === g.phase.card && player.state !== 'idle' && player.state !== 'error') return;
    this.playCard(g.phase.card);
  }

  /** Play button when nothing is loaded (after an error, or once the song was stopped). */
  replayCurrent() {
    const g = this.game;
    if (!g || (g.phase.t !== 'listen' && g.phase.t !== 'challenge' && g.phase.t !== 'reveal')) return;
    this.playCard(g.phase.card);
  }

  /** Keeps the next cards decoded so a tap starts the music instantly. */
  preloadAhead() {
    const g = this.game;
    if (!g || this.settings.playback !== 'preview') return;
    const ids: string[] = [];
    if (g.phase.t === 'listen') ids.push(g.phase.card);
    ids.push(...g.deck.slice(-2).reverse());
    for (const id of ids) {
      const s = songsById.get(id);
      if (s) player.preload(s).catch(() => {});
    }
  }

  private playCard(card: string) {
    const s = songsById.get(card);
    if (!s) return;
    store.markSeen([card]);
    this.audioError = null;
    if (this.settings.playback === 'spotify') {
      openExternal(spotifyUrl(s));
      return;
    }
    player.play(s).then(
      () => this.preloadAhead(),
      () => {
        if (this.game?.phase.t === 'listen' && this.game.phase.card === card) {
          this.audioError = 'Non riesco a caricare questa sigla (connessione assente o brano non disponibile).';
        }
      },
    );
  }

  draw() {
    const g = this.game;
    if (!g) return;
    this.guard(() => {
      player.unlock();
      const next = E.drawCard(g);
      this.set(next);
      sfx.draw();
      haptics.tap();
      if (next.phase.t === 'listen') this.playCard(next.phase.card);
    });
  }

  setSlot(slot: number | null) {
    const g = this.game;
    if (!g || g.phase.t !== 'listen' || g.phase.slot === slot) return;
    this.set(E.setSlot(g, slot), false);
    sfx.place();
    haptics.place();
  }

  skip() {
    const g = this.game;
    if (!g) return;
    this.guard(() => {
      const next = E.skipCard(g);
      this.set(next);
      sfx.chip();
      haptics.coin();
      if (next.phase.t === 'listen') this.playCard(next.phase.card);
    });
  }

  swapUnplayable() {
    const g = this.game;
    if (!g) return;
    this.guard(() => {
      const next = E.swapUnplayable(g);
      this.set(next);
      sfx.draw();
      if (next.phase.t === 'listen') this.playCard(next.phase.card);
    });
  }

  buy() {
    const g = this.game;
    if (!g) return;
    this.guard(() => {
      const wasIntro = g.phase.t === 'intro';
      const next = E.buyCard(g, songsById);
      this.set(next);
      sfx.chip(E.BUY_COST);
      haptics.coin();
      if (next.phase.t === 'reveal') {
        if (wasIntro) store.markSeen([next.phase.card]);
        this.startReveal();
      }
    });
  }

  confirm() {
    const g = this.game;
    if (!g) return;
    this.guard(() => {
      const next = E.confirmPlacement(g, songsById);
      this.set(next);
      if (next.phase.t === 'challenge') {
        sfx.challenge();
        haptics.tap();
      } else this.startReveal();
    });
  }

  addChallenge(playerId: string, slot: number) {
    const g = this.game;
    if (!g) return;
    this.guard(() => {
      this.set(E.addChallenge(g, playerId, slot));
      sfx.chip();
      haptics.coin();
    });
  }

  removeChallenge(playerId: string) {
    const g = this.game;
    if (!g) return;
    this.guard(() => this.set(E.removeChallenge(g, playerId), false));
  }

  reveal() {
    const g = this.game;
    if (!g) return;
    this.guard(() => {
      this.set(E.reveal(g, songsById));
      this.startReveal();
    });
  }

  private startReveal() {
    this.revealing = true;
  }

  /** Called by the reveal overlay when its flip animation lands. */
  revealLanded() {
    const g = this.game;
    if (!g || g.phase.t !== 'reveal') return;
    const o = g.phase.outcome;
    if (o.bought || o.placementCorrect) {
      sfx.correct();
      haptics.correct();
    } else if (o.stolenBy) {
      sfx.steal();
      haptics.correct();
    } else {
      sfx.wrong();
      haptics.wrong();
    }
  }

  resolve(guess: E.Guess) {
    const g = this.game;
    if (!g) return;
    this.guard(() => {
      const earned = E.earnsToken(g, guess);
      const next = E.resolveTurn(g, songsById, guess);
      this.revealing = false;
      this.set(next);
      if (earned) {
        sfx.coin();
        haptics.coin();
      }
      if (next.phase.t === 'intro') {
        this.stopMusic();
        sfx.turn();
        this.preloadAhead();
      }
    });
  }

  undo() {
    const prev = this.undoStack.pop();
    if (!prev) return;
    this.game = prev;
    this.canUndo = this.undoStack.length > 0;
    this.revealing = prev.phase.t === 'reveal';
    store.saveGame(prev);
    this.menuOpen = false;
    this.audioError = null;
    if (prev.phase.t === 'intro' || prev.phase.t === 'over') this.stopMusic();
    // Back to listening or to the challenge (e.g. after undoing a skip): that card's song must play.
    else this.ensureCardMusic();
    toast('Ultima mossa annullata');
  }

  abandon() {
    const g = this.game;
    if (!g) return;
    this.menuOpen = false;
    this.set(E.abandonGame(g), false);
  }

  /** Forget the current game (after the victory screen). */
  closeGame() {
    this.game = null;
    this.undoStack = [];
    this.canUndo = false;
    this.revealing = false;
    store.saveGame(null);
    this.stopMusic();
    keepAwake(false);
  }

  rematch() {
    const g = this.game;
    if (!g) return;
    const players = g.players.map((p) => ({ name: p.name, avatar: p.avatar, color: p.color }));
    // Whoever collected the fewest cards takes the first turn of the rematch.
    let first = 0;
    g.players.forEach((p, i) => {
      if (p.timeline.length < g.players[first].timeline.length) first = i;
    });
    const settings = g.settings;
    this.closeGame();
    this.newGame(players, settings, g.team ? 0 : first);
  }

  private finish(g: GameState) {
    if (g.phase.t !== 'over') return;
    this.revealing = false;
    this.stopMusic();
    keepAwake(false);
    const winners = g.phase.winners;
    store.addHistory({
      id: g.id,
      startedAt: g.createdAt,
      endedAt: Date.now(),
      mode: g.settings.mode,
      target: g.settings.target,
      reason: g.phase.reason,
      turns: g.turn,
      winners: g.players.filter((p) => winners.includes(p.id)).map((p) => p.name),
      players: g.players.map((p) => ({
        name: p.name,
        avatar: p.avatar,
        color: p.color,
        cards: g.team ? g.team.timeline.length : p.timeline.length,
        tokens: p.tokens,
        correct: p.stats.correct,
        placed: p.stats.placed,
        steals: p.stats.steals,
        bestStreak: p.stats.bestStreak,
      })),
      team: g.team ? { cards: g.team.timeline.length, tokens: g.team.tokens } : undefined,
    });
    if (g.phase.reason === 'coop-lost') {
      sfx.wrong();
    } else if (g.phase.winners.length || g.phase.reason === 'coop-won') {
      setTimeout(() => sfx.fanfare(), 250);
      haptics.win();
    }
  }

  dismissToast(id: number) {
    this.toasts = this.toasts.filter((t) => t.id !== id);
  }
}

export const app = new App();
export { toast };
export type { Song };
