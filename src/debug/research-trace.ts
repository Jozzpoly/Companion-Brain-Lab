import type { CompanionMode } from "../brain/relational-positioning";
import type { WorldSnapshot } from "../world/types";

export type DebugScalar = string | number | boolean | null;

export interface DebugFieldSet {
  readonly [key: string]: DebugScalar;
}

export interface PublicDebugChannel {
  id: string;
  summary: string;
  fields?: DebugFieldSet;
}

export interface TraceActorSample {
  id: string;
  x: number;
  y: number;
  requestedSpeed: number;
  actualSpeed: number;
  motionError: number;
  contacts: readonly string[];
}

export interface TraceSample {
  tick: number;
  scenarioId: string;
  companionMode: CompanionMode;
  actors: readonly TraceActorSample[];
  channels: readonly PublicDebugChannel[];
}

export interface TraceEvent {
  sequence: number;
  tick: number;
  kind: string;
  summary: string;
  actorId?: string;
  fields?: DebugFieldSet;
}

export interface IncidentBundle {
  schema: "companion-brain-lab-incident-v1";
  capturedAtTick: number;
  scenarioId: string;
  companionMode: CompanionMode;
  label: string;
  samples: readonly TraceSample[];
  events: readonly TraceEvent[];
  currentChannels: readonly PublicDebugChannel[];
}

export const S2_TRACE_SAMPLE_CAPACITY = 900;
export const S2_TRACE_EVENT_CAPACITY = 240;

function speed(x: number, y: number): number {
  return Math.hypot(x, y);
}

function cloneFields(fields: DebugFieldSet | undefined): DebugFieldSet | undefined {
  return fields ? { ...fields } : undefined;
}

function cloneChannel(channel: PublicDebugChannel): PublicDebugChannel {
  return {
    id: channel.id,
    summary: channel.summary,
    fields: cloneFields(channel.fields)
  };
}

function cloneSample(sample: TraceSample): TraceSample {
  return {
    tick: sample.tick,
    scenarioId: sample.scenarioId,
    companionMode: sample.companionMode,
    actors: sample.actors.map((actor) => ({
      ...actor,
      contacts: [...actor.contacts]
    })),
    channels: sample.channels.map(cloneChannel)
  };
}

function cloneEvent(event: TraceEvent): TraceEvent {
  return {
    ...event,
    fields: cloneFields(event.fields)
  };
}

export class ResearchTrace {
  private readonly samples: TraceSample[] = [];
  private readonly events: TraceEvent[] = [];
  private eventSequence = 0;

  reset(): void {
    this.samples.length = 0;
    this.events.length = 0;
    this.eventSequence = 0;
  }

  recordSample(
    snapshot: WorldSnapshot,
    companionMode: CompanionMode,
    channels: readonly PublicDebugChannel[] = []
  ): void {
    const sample: TraceSample = {
      tick: snapshot.tick,
      scenarioId: snapshot.scenarioId,
      companionMode,
      actors: snapshot.actors.map((actor) => ({
        id: actor.id,
        x: actor.position.x,
        y: actor.position.y,
        requestedSpeed: speed(actor.requestedVelocity.x, actor.requestedVelocity.y),
        actualSpeed: speed(actor.actualVelocity.x, actor.actualVelocity.y),
        motionError: actor.motionError,
        contacts: actor.contacts.map((contact) => contact.with)
      })),
      channels: channels.map(cloneChannel)
    };

    this.samples.push(sample);
    if (this.samples.length > S2_TRACE_SAMPLE_CAPACITY) {
      this.samples.splice(0, this.samples.length - S2_TRACE_SAMPLE_CAPACITY);
    }
  }

  recordEvent(
    tick: number,
    kind: string,
    summary: string,
    options?: {
      actorId?: string;
      fields?: DebugFieldSet;
    }
  ): TraceEvent {
    const event: TraceEvent = {
      sequence: ++this.eventSequence,
      tick,
      kind,
      summary,
      actorId: options?.actorId,
      fields: cloneFields(options?.fields)
    };
    this.events.push(event);
    if (this.events.length > S2_TRACE_EVENT_CAPACITY) {
      this.events.splice(0, this.events.length - S2_TRACE_EVENT_CAPACITY);
    }
    return cloneEvent(event);
  }

  recentEvents(limit = 8): readonly TraceEvent[] {
    if (!Number.isInteger(limit) || limit < 0) throw new Error("Trace event limit must be a non-negative integer.");
    return this.events.slice(Math.max(0, this.events.length - limit)).map(cloneEvent);
  }

  sampleCount(): number {
    return this.samples.length;
  }

  eventCount(): number {
    return this.events.length;
  }

  captureIncident(
    snapshot: WorldSnapshot,
    companionMode: CompanionMode,
    label: string,
    currentChannels: readonly PublicDebugChannel[] = []
  ): IncidentBundle {
    return {
      schema: "companion-brain-lab-incident-v1",
      capturedAtTick: snapshot.tick,
      scenarioId: snapshot.scenarioId,
      companionMode,
      label,
      samples: this.samples.map(cloneSample),
      events: this.events.map(cloneEvent),
      currentChannels: currentChannels.map(cloneChannel)
    };
  }
}
