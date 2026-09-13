import { describe, expect, it } from "vitest";
import type { ActorSnapshot, WorldSnapshot } from "../world/types";
import {
  ResearchTrace,
  S2_TRACE_EVENT_CAPACITY,
  S2_TRACE_SAMPLE_CAPACITY
} from "./research-trace";

function actor(id: ActorSnapshot["id"], x: number, y: number): ActorSnapshot {
  return {
    id,
    position: { x, y },
    radius: 0.3,
    requestedVelocity: { x: 1, y: 0 },
    actualVelocity: { x: 0.5, y: 0 },
    motionError: 0.5,
    contacts: [{ with: "wall", contactCount: 1 }]
  };
}

function snapshot(tick: number): WorldSnapshot {
  return {
    tick,
    scenarioId: "doorway",
    width: 12,
    height: 8,
    actors: [actor("player", 4, 4), actor("companion", 5, 4)],
    obstacles: []
  };
}

describe("S2 research trace", () => {
  it("records compact public samples without retaining mutable caller objects", () => {
    const trace = new ResearchTrace();
    const state = snapshot(4);
    const channel = { id: "brain", summary: "slot back", fields: { slot: "back" } };

    trace.recordSample(state, "relational", [channel]);
    state.actors[0]!.position.x = 99;
    channel.fields.slot = "front";

    const incident = trace.captureIncident(snapshot(5), "relational", "test");
    expect(incident.samples).toHaveLength(1);
    expect(incident.samples[0]?.actors[0]?.x).toBe(4);
    expect(incident.samples[0]?.channels[0]?.fields?.slot).toBe("back");
  });

  it("bounds the rolling per-tick sample buffer", () => {
    const trace = new ResearchTrace();
    for (let tick = 0; tick < S2_TRACE_SAMPLE_CAPACITY + 5; tick += 1) {
      trace.recordSample(snapshot(tick), "relational");
    }
    expect(trace.sampleCount()).toBe(S2_TRACE_SAMPLE_CAPACITY);
    const incident = trace.captureIncident(snapshot(9999), "relational", "bounded");
    expect(incident.samples[0]?.tick).toBe(5);
  });

  it("bounds causal events and preserves monotonic sequence numbers", () => {
    const trace = new ResearchTrace();
    for (let index = 0; index < S2_TRACE_EVENT_CAPACITY + 3; index += 1) {
      trace.recordEvent(index, "test", `event ${index}`);
    }
    expect(trace.eventCount()).toBe(S2_TRACE_EVENT_CAPACITY);
    const events = trace.recentEvents(3);
    expect(events).toHaveLength(3);
    expect(events[2]?.sequence).toBe(S2_TRACE_EVENT_CAPACITY + 3);
    expect(events[2]?.summary).toBe(`event ${S2_TRACE_EVENT_CAPACITY + 2}`);
  });

  it("captures incident metadata and resets independently", () => {
    const trace = new ResearchTrace();
    trace.recordSample(snapshot(10), "relational");
    trace.recordEvent(10, "brain.slot", "selected back", { actorId: "companion", fields: { slot: "back" } });

    const incident = trace.captureIncident(snapshot(11), "relational", "doorway block", [
      { id: "progress", summary: "blocked", fields: { stuck: true } }
    ]);

    expect(incident.schema).toBe("companion-brain-lab-incident-v1");
    expect(incident.capturedAtTick).toBe(11);
    expect(incident.label).toBe("doorway block");
    expect(incident.events[0]?.fields?.slot).toBe("back");
    expect(incident.currentChannels[0]?.fields?.stuck).toBe(true);

    trace.reset();
    expect(trace.sampleCount()).toBe(0);
    expect(trace.eventCount()).toBe(0);
  });
});
