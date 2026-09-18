// Host half: serve the workspace keybinding config file to the Client half
// via a Package-private JSON RPC. Lossless JSON only.
return {
  async apply(ctx) {
    const CONFIG_PATH = 'emacs-keybindings.json'
    harness.handle('emacs-keybindings:read', async () => {
      const fs = ctx.get('fs')
      if (fs === undefined) return { ok: false, error: 'fs service unavailable' }
      try {
        const text = await fs.readText(CONFIG_PATH)
        return { ok: true, text }
      } catch (err) {
        try {
          const target = await fs.resolve(CONFIG_PATH)
          const text = await fs.readText(target)
          return { ok: true, text }
        } catch (err2) {
          return { ok: false, error: String((err2 && err2.message) || err2) }
        }
      }
    })
  },
}