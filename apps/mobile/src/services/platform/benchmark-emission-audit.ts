type Rejection = 'metadata' | 'clock' | 'runtime' | 'budget';
type Terminal = 'pending' | 'response' | 'network' | 'aborted';
type TransportDisposition = {
  requestSequence: number;
  terminal: Terminal;
  validation: 'pending' | 'accepted' | Rejection;
  sink: 'pending' | 'returned' | 'threw';
};

/** Fixed dispositions only: rejected objects and transport payloads never enter this audit. */
export class BenchmarkEmissionAudit {
  private requestHighWater = 0;
  private overflowCount = 0;
  private sinkReturned = 0;
  private sinkThrew = 0;
  private readonly transports: TransportDisposition[] = [];
  private readonly rejections = {
    metadata: 0,
    clock: 0,
    runtime: 0,
    budget: 0
  };

  allocate(requestSequence: number): void {
    this.requestHighWater = requestSequence;
    if (this.transports.length === 16) {
      this.overflowCount++;
      return;
    }
    this.transports.push({
      requestSequence,
      terminal: 'pending',
      validation: 'pending',
      sink: 'pending'
    });
  }

  terminal(
    requestSequence: number,
    terminal: Exclude<Terminal, 'pending'>
  ): void {
    const transport = this.transports.find(
      (entry) => entry.requestSequence === requestSequence
    );
    if (transport) transport.terminal = terminal;
  }

  reject(reason: Rejection, requestSequence?: number): void {
    this.rejections[reason]++;
    const transport = this.transports.find(
      (entry) => entry.requestSequence === requestSequence
    );
    if (transport) transport.validation = reason;
  }

  accept(requestSequence?: number): void {
    const transport = this.transports.find(
      (entry) => entry.requestSequence === requestSequence
    );
    if (transport) transport.validation = 'accepted';
  }

  delivered(sink: 'returned' | 'threw', requestSequence?: number): void {
    if (sink === 'returned') this.sinkReturned++;
    else this.sinkThrew++;
    const transport = this.transports.find(
      (entry) => entry.requestSequence === requestSequence
    );
    if (transport) transport.sink = sink;
  }

  snapshot() {
    return {
      requestHighWater: this.requestHighWater,
      overflowCount: this.overflowCount,
      sinkReturned: this.sinkReturned,
      sinkThrew: this.sinkThrew,
      rejections: { ...this.rejections },
      transports: this.transports.map((entry) => ({ ...entry }))
    };
  }
}
