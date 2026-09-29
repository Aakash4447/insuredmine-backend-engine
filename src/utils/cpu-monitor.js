const os = require('node:os');

const logger = require('./logger');

const DEFAULT_INTERVAL_MS = 3000;
const DEFAULT_THRESHOLD = 70;

// cumulative idle and total CPU time (ms) across all cores since boot
const readCpuTimes = () => os.cpus().reduce((sum, { times }) => ({
  idle: sum.idle + times.idle,
  total: sum.total + Object.values(times).reduce((all, value) => all + value, 0),
}), { idle: 0, total: 0 });

// system-wide CPU usage (0-100) between two readCpuTimes() snapshots
const getCpuUsage = (previous, current) => {
  const total = current.total - previous.total;
  if (total <= 0) return 0;
  return ((total - (current.idle - previous.idle)) / total) * 100;
};

// samples CPU usage every `intervalMs`; once it reaches `threshold` percent, logs a warning and calls onExceed(usage) a single time.
// Returns a function that stops the monitor.
const startCpuMonitor = ({ intervalMs = DEFAULT_INTERVAL_MS, threshold = DEFAULT_THRESHOLD, onExceed }) => {
  let previous = readCpuTimes();

  const timer = setInterval(() => {
    const current = readCpuTimes();
    const usage = getCpuUsage(previous, current);
    previous = current;
    if (usage < threshold) return;

    clearInterval(timer);
    logger.warn(`CPU usage ${usage.toFixed(1)}% reached the ${threshold}% threshold at ${new Date().toISOString()}`);
    onExceed(usage);
  }, intervalMs);
  timer.unref();

  return () => clearInterval(timer);
};

module.exports = { getCpuUsage, readCpuTimes, startCpuMonitor };
