import type { Metric } from 'web-vitals';

type WebVitalsWindow = Window & {
  __BETLEAGUE_WEB_VITALS__?: Metric[];
};

const endpoint = process.env.REACT_APP_WEB_VITALS_ENDPOINT?.trim();
const debugEnabled = process.env.REACT_APP_WEB_VITALS_DEBUG === 'true' || process.env.NODE_ENV !== 'production';

const defaultReporter = (metric: Metric) => {
  const enrichedMetric = metric as Metric & { rating?: string; navigationType?: string };
  const targetWindow = window as WebVitalsWindow;
  targetWindow.__BETLEAGUE_WEB_VITALS__ = [...(targetWindow.__BETLEAGUE_WEB_VITALS__ ?? []), metric];

  if (debugEnabled) {
    console.info('[web-vitals]', metric.name, {
      value: metric.value,
      rating: enrichedMetric.rating,
      id: metric.id,
      delta: metric.delta,
    });
  }

  if (endpoint && navigator.sendBeacon) {
    const payload = JSON.stringify({
      name: metric.name,
      value: metric.value,
      rating: enrichedMetric.rating,
      delta: metric.delta,
      id: metric.id,
      navigationType: enrichedMetric.navigationType,
    });
    navigator.sendBeacon(endpoint, payload);
  }
};

const reportWebVitals = (onPerfEntry?: (metric: Metric) => void) => {
  const reporter = onPerfEntry ?? defaultReporter;

  import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
    getCLS(reporter);
    getFID(reporter);
    getLCP(reporter);
    getFCP(reporter);
    getTTFB(reporter);
  });
};

export default reportWebVitals;



