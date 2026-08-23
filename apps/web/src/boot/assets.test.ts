import { describe, it, expect, beforeEach } from "vitest";
import { register, report, done, aggregate, reset, label, currentLabel } from "./assets";

beforeEach(reset);

describe("weighted progress", () => {
  it("weights by cost, so a cheap asset cannot leap the bar to half", () => {
    register("corpus", 1);
    register("model", 9);
    done("corpus");
    /* Evenly averaged this reads 0.5, which is the lie this exists to avoid. */
    expect(aggregate()).toBeCloseTo(0.1, 5);
  });

  it("is monotonic per asset, so a retry never walks the bar backwards", () => {
    register("model", 1);
    report("model", 0.8);
    report("model", 0.2);
    expect(aggregate()).toBeCloseTo(0.8, 5);
  });

  it("clamps an out of range report rather than trusting it", () => {
    register("a", 1);
    report("a", 5);
    expect(aggregate()).toBe(1);
  });

  it("reads zero with nothing registered rather than dividing by zero", () => {
    expect(aggregate()).toBe(0);
  });
});

describe("readout", () => {
  it("names the first unfinished asset, in registration order", () => {
    register("corpus", 1);
    register("model", 1);
    label("corpus", "reading the record");
    label("model", "warming the search model");
    expect(currentLabel()).toBe("reading the record");
    done("corpus");
    expect(currentLabel()).toBe("warming the search model");
  });

  it("says ready when everything is finished", () => {
    register("a", 1);
    done("a");
    expect(currentLabel()).toBe("ready");
  });
});
