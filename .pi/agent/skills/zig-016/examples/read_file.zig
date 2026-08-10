const std = @import("std");

pub fn main(init: std.process.Init) !void {
    const io = init.io;
    const gpa = init.gpa;
    const data = try std.Io.Dir.cwd().readFileAlloc(io, "build.zig.zon", gpa, .limited(1 << 20));
    defer gpa.free(data);
    std.log.info("read {d} bytes", .{data.len});
}
