// Home Dynamic Content System v1. This module only uses local time and is safe for static hosting.
(function attachHomeDynamicContent(global) {
  const PERIODS = Object.freeze([
    Object.freeze({ period: "morning", startHour: 5, endHour: 11, title: "Good Morning", subtitle: "A new day begins at Shi-Gai.", greeting: "Welcome back.", heroClass: "hero--morning", characterState: "awake", backgroundState: "morning" }),
    Object.freeze({ period: "afternoon", startHour: 12, endHour: 16, title: "Good Afternoon", subtitle: "Take a gentle look around Shi-Gai.", greeting: "Hello there.", heroClass: "hero--afternoon", characterState: "exploring", backgroundState: "afternoon" }),
    Object.freeze({ period: "evening", startHour: 17, endHour: 20, title: "Good Evening", subtitle: "Slow down and explore a little more.", greeting: "Nice to see you.", heroClass: "hero--evening", characterState: "winding-down", backgroundState: "evening" }),
    Object.freeze({ period: "night", startHour: 21, endHour: 4, title: "Good Night", subtitle: "A quiet time to wander through Shi-Gai.", greeting: "Stay awhile.", heroClass: "hero--night", characterState: "resting", backgroundState: "night" })
  ]);
  const FUTURE_CONTEXT_KEYS = Object.freeze(["weather", "season", "holiday", "randomEvent"]);

  function getPeriodForHour(hour) {
    return PERIODS.find((item) => item.period !== "night" && hour >= item.startHour && hour <= item.endHour) || PERIODS[3];
  }

  function createFutureContext(overrides = {}) {
    return FUTURE_CONTEXT_KEYS.reduce((context, key) => {
      context[key] = overrides[key] ?? null;
      return context;
    }, {});
  }

  function getCurrentHomeContent(date = new Date(), futureContext = {}) {
    const period = getPeriodForHour(date.getHours());
    return Object.freeze({ ...period, ...createFutureContext(futureContext) });
  }

  global.ShiGaiHomeDynamic = Object.freeze({ periods: PERIODS, getCurrentHomeContent, createFutureContext });
})(window);
