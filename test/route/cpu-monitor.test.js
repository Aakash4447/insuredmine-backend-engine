const os = require('node:os');

const { getCpuUsage, startCpuMonitor } = require('../../src/utils/cpu-monitor');
const logger = require('../../src/utils/logger');

jest.mock('../../src/utils/logger', () => ({ error: jest.fn(), info: jest.fn(), warn: jest.fn() }));

// one core whose cumulative times advance by `busy` and `idle` ms per sample
const cpuTimes = ({ busy, idle }) => [{
  times: {
    user: busy, nice: 0, sys: 0, idle, irq: 0,
  },
}];

describe('getCpuUsage', () => {
  it('is the busy share of the elapsed CPU time, in percent', () => {
    expect(getCpuUsage({ idle: 100, total: 200 }, { idle: 130, total: 300 })).toBe(70);
  });

  it('is 0 when no time has elapsed', () => {
    expect(getCpuUsage({ idle: 5, total: 10 }, { idle: 5, total: 10 })).toBe(0);
  });
});

describe('startCpuMonitor', () => {
  let onExceed;

  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers();
    onExceed = jest.fn();
  });

  afterEach(() => jest.useRealTimers());

  it('stays quiet while usage is below the threshold', () => {
    jest.spyOn(os, 'cpus')
      .mockReturnValueOnce(cpuTimes({ busy: 0, idle: 0 }))
      .mockReturnValueOnce(cpuTimes({ busy: 69, idle: 31 }));
    startCpuMonitor({ intervalMs: 3000, onExceed });
    jest.advanceTimersByTime(3000);
    expect(onExceed).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('warns with the percentage and timestamp and calls onExceed once when usage reaches 70%', () => {
    jest.setSystemTime(new Date('2026-01-02T03:04:05.000Z'));
    jest.spyOn(os, 'cpus')
      .mockReturnValueOnce(cpuTimes({ busy: 0, idle: 0 }))
      .mockReturnValue(cpuTimes({ busy: 70, idle: 30 }));
    startCpuMonitor({ intervalMs: 3000, onExceed });
    jest.advanceTimersByTime(9000);
    expect(onExceed).toHaveBeenCalledTimes(1);
    expect(onExceed).toHaveBeenCalledWith(70);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith('CPU usage 70.0% reached the 70% threshold at 2026-01-02T03:04:08.000Z');
  });

  it('samples usage between consecutive intervals, not since boot', () => {
    jest.spyOn(os, 'cpus')
      .mockReturnValueOnce(cpuTimes({ busy: 1000, idle: 0 }))
      .mockReturnValueOnce(cpuTimes({ busy: 1010, idle: 90 }))
      .mockReturnValueOnce(cpuTimes({ busy: 1090, idle: 110 }));
    startCpuMonitor({ intervalMs: 3000, onExceed });
    jest.advanceTimersByTime(3000);
    expect(onExceed).not.toHaveBeenCalled();
    jest.advanceTimersByTime(3000);
    expect(onExceed).toHaveBeenCalledWith(80);
  });

  it('stops sampling when the returned stop function is called', () => {
    jest.spyOn(os, 'cpus').mockReturnValue(cpuTimes({ busy: 0, idle: 0 }));
    const stop = startCpuMonitor({ intervalMs: 3000, onExceed });
    stop();
    os.cpus.mockReturnValue(cpuTimes({ busy: 100, idle: 0 }));
    jest.advanceTimersByTime(9000);
    expect(onExceed).not.toHaveBeenCalled();
  });
});
