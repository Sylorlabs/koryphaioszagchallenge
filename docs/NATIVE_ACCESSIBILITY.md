# Native accessibility foundation

The native shell now has a pure-Zag accessibility model independent of its pixels. The model exposes a rooted hierarchy with stable node IDs, parent/child relationships, roles, names, descriptions, values, states, actions, and deterministic tab order. The initial semantic shell covers the application, workspace frame, session navigation and list, conversation document, multiline composer, Send action, and live-status region.

Keyboard focus and semantic focus use the same state. Tab and Shift-Tab traverse only visible, enabled, focusable nodes and wrap deterministically. Direct focus rejects hidden, disabled, missing, or non-focusable nodes. Editable text and activation are typed actions; invoking an action on the wrong role fails with a stable diagnostic instead of mutating state. Interactive nodes without accessible names are rejected when the tree is built.

`src/native/atspi.zag` also defines a fail-closed AT-SPI connection lifecycle and encodes the standard `org.a11y.Bus.GetAddress` D-Bus discovery call. Merely creating the tree, authenticating to the session bus, or encoding discovery traffic never marks the endpoint registered. Registration requires ordered, validated transitions through accessibility-bus connection and object-server readiness.

The deterministic test is:

```sh
toolchain/zag/zag-poc/znc src/native/atspi_test.zag -o build/atspi_test --analyze-strict
build/atspi_test
```

## Remaining integration gaps

This is a semantics and wire-framing foundation, not a claim of live screen-reader interoperability. The application event loop does not yet connect to the session bus, parse the `GetAddress` reply, authenticate to the separate accessibility bus, serve `org.a11y.atspi.Accessible`, `Component`, `Action`, and `Text` objects, or emit AT-SPI focus/property/children events. The renderer and widgets must next build and update this tree from their retained state, and the release gate must exercise the live application with an AT-SPI client and a screen reader. Until all of those steps succeed, the release accessibility gate remains incomplete.
