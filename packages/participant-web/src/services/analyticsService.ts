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
    console.log('📊 Google Analytics initialized (Participant)');
  }

  /**
   * Track page view
   */
  pageView(path: string, title?: string) {
    if (!this.initialized) return;
    ReactGA.send({ hitType: 'pageview', page: path, title });
  }
}

export const analyticsService = new AnalyticsService();
