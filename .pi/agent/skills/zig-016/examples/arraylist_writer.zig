const std = @import("std");

test "unmanaged ArrayList" {
    const gpa = std.testing.allocator;
    var list: std.ArrayList(u8) = .empty;
    defer list.deinit(gpa);
    try list.appendSlice(gpa, "hello");
    try list.append(gpa, '!');
    try std.testing.expectEqualStrings("hello!", list.items);
}

test "fixed Writer + print" {
    var buf: [64]u8 = undefined;
    var w: std.Io.Writer = .fixed(&buf);
    try w.print("n={d}", .{42});
    try std.testing.expectEqualStrings("n=42", w.buffered());
}

test "fixed Reader" {
    var r: std.Io.Reader = .fixed("abc\ndef\n");
    const line = try r.takeDelimiterExclusive('\n');
    try std.testing.expectEqualStrings("abc", line);
}
