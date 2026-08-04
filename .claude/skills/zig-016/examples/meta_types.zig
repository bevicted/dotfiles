const std = @import("std");

test "type-creating builtins replace @Type" {
    const U10 = @Int(.unsigned, 10);
    try std.testing.expectEqual(10, @bitSizeOf(U10));

    const Pair = @Tuple(&.{ u32, u8 });
    const p: Pair = .{ 1, 2 };
    try std.testing.expectEqual(@as(u32, 1), p[0]);

    // float -> int via @round/@floor/@ceil/@trunc (not @intFromFloat)
    const n: u8 = @round(@as(f32, 12.6));
    try std.testing.expectEqual(@as(u8, 13), n);

    // small int -> float coerces implicitly
    const small: u16 = 300;
    const f: f32 = small;
    try std.testing.expectEqual(@as(f32, 300.0), f);
}
