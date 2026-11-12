/**
 * Stylesheet order is part of the look.
 *
 * Several component stylesheets override each other (for example a Theory
 * button's `text-transform: none` against the shared glass pill) and the one
 * loaded last wins. CSS loads in the order its components are first imported,
 * which App.tsx's own import list used to fix. Now that App only wires modes
 * together, this file pins that order; App imports it first. Add a component
 * here only when moving its styles would change how something looks.
 */
import './components/Fretboard';
import './components/PositionSlider';
import './components/DisplayToggles';
import './components/AudioControls';
import './components/DebugPanel';
import './components/AmbientBackground';
import './components/KeySelector';
import './components/KeyContext';
import './components/Popover';
import './components/UiThemeSelector';
import './components/Frame';
import './components/PracticeSession';
import './components/SettingsList';
import './components/StudyModeControls';
import './components/ChordPositionStrip';
import './components/ProgressionStrip';
import './components/IntervalTrainer';
import './components/TheoryPanel';
import './components/TheoryNavigator';
import './components/TheoryStage';
