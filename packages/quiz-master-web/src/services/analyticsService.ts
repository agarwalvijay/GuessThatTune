import ReactGA from 'react-ga4';

class AnalyticsService {
  private initialized = false;

  /**
   * Initialize Google Analytics
   */
  initialize() {
    if (this.initialized) return;

    ReactGA.initialize('G-FRNR97D18L');
    this.initialized = true;
    console.log('📊 Google Analytics initialized');
  }

  /**
   * Track page view
   */
  pageView(path: string, title?: string) {
    if (!this.initialized) return;
    ReactGA.send({ hitType: 'pageview', page: path, title });
  }

  /**
   * Track game created event
   */
  trackGameCreated(data: {
    numberOfSongs: number;
    songDuration: number;
    negativePointsPercentage: number;
    buzzerCountdownSeconds: number;
  }) {
    if (!this.initialized) return;

    ReactGA.event({
      category: 'Game',
      action: 'Game Created',
      label: `${data.numberOfSongs} songs, ${data.songDuration}s duration`,
      value: data.numberOfSongs,
    });

    console.log('📊 Tracked: Game Created', data);
  }

  /**
   * Track game started event
   */
  trackGameStarted(data: {
    sessionId: string;
    numberOfParticipants: number;
    numberOfSongs: number;
  }) {
    if (!this.initialized) return;

    ReactGA.event({
      category: 'Game',
      action: 'Game Started',
      label: `${data.numberOfParticipants} participants`,
      value: data.numberOfParticipants,
    });

    console.log('📊 Tracked: Game Started', data);
  }

  /**
   * Track game ended event
   */
  trackGameEnded(data: {
    sessionId: string;
    numberOfParticipants: number;
    numberOfSongs: number;
    completedSongs: number;
  }) {
    if (!this.initialized) return;

    ReactGA.event({
      category: 'Game',
      action: 'Game Ended',
      label: `${data.completedSongs}/${data.numberOfSongs} songs completed`,
      value: data.numberOfParticipants,
    });

    console.log('📊 Tracked: Game Ended', data);
  }

  /**
   * Track participant joined
   */
  trackParticipantJoined(data: {
    sessionId: string;
    totalParticipants: number;
  }) {
    if (!this.initialized) return;

    ReactGA.event({
      category: 'Participants',
      action: 'Participant Joined',
      label: data.sessionId,
      value: data.totalParticipants,
    });

    console.log('📊 Tracked: Participant Joined', data);
  }
}

export const analyticsService = new AnalyticsService();
