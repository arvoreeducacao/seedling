import { describe, expect, it } from "vitest";
import { parseListening } from "./ports";

const sample = `  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode
   0: 0100007F:1F90 00000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 1 1 0000000000000000 100 0 0 10 0
   1: 0100007F:1F90 0100007F:D3C2 01 00000000:00000000 00:00000000 00000000  1000        0 2 1 0000000000000000 20 4 30 10 -1
  sl  local_address                         remote_address                        st tx_queue rx_queue
   0: 00000000000000000000000001000000:1435 00000000000000000000000000000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 3 1
   1: 00000000000000000000000000000000:0BB8 00000000000000000000000000000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 4 1`;

describe("parseListening", () => {
  it("keeps only sockets in LISTEN state, deduplicated and sorted", () => {
    expect(parseListening(sample)).toEqual([3000, 5173, 8080]);
  });

  it("ignores garbage", () => {
    expect(parseListening("cat: /proc/net/tcp6: No such file\n")).toEqual([]);
  });
});
