namespace BookingApp.Domain;

// Mirrors src/services/settingsService.js. Vendor-level switches.
public class SettingsService
{
    private readonly MemoryStore _store;

    public SettingsService(MemoryStore store)
    {
        _store = store;
    }

    public Settings Get() => _store.Settings;

    // Assumption A3: any provider account acts as vendor admin until a real admin role exists.
    public Settings Update(Actor? actor, bool requireRegistration)
    {
        if (actor?.Role != "provider") throw Errors.Forbidden("only vendor staff can change settings");
        _store.Settings.RequireRegistration = requireRegistration;
        return _store.Settings;
    }
}
