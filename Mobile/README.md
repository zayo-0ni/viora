# Mobile

Reserved. There is no phone build right now.

Viora targets an Android television. The phone layout — the bottom tab bar, the
touch targets, the long-press context menu, the gesture handling — was removed
from the app; the README's "One target" section says what went and why.

## run-mobile-emulator.bat

It works, and what it installs is the **television** build running on a
phone-shaped screen: a side rail instead of a tab bar, and focus that moves by
D-pad rather than by touch. Useful for seeing how the layout behaves at that
size, not for judging a phone experience — there isn't one to judge yet.

There is also no phone emulator on this machine; both installed images are
Android TV. The script says so and explains how to create one. Once you have it:

```
run-mobile-emulator.bat Pixel_7_API_34
```

With no argument it picks the first non-TV emulator it finds.

## If the phone build comes back

The launcher is already here. What would also be needed:

- a `phone` form factor in `src/lib/platform.ts`, which now returns a constant
- the touch entries in `src/lib/capabilities.ts`
- a touch layout in `src/App.tsx`, where the phone branch used to be

All of it is in the history — `git log --oneline main..tv-only` — so it can be
read back rather than reinvented.
