namespace BookingApp.Domain;

// Mirrors src/repositories/memoryStore.js: in-memory storage behind a tiny
// repository interface (insert / get / update / where). Tests use this instead
// of a real database, so no test touches a network or external service.
public interface IIdentifiable
{
    string Id { get; }
}

public class Collection<T> where T : IIdentifiable
{
    private readonly Dictionary<string, T> _items = new();

    public T Insert(T item)
    {
        _items[item.Id] = item;
        return item;
    }

    public T? Get(string id) => _items.TryGetValue(id, out var item) ? item : default;

    public T? Update(string id, Action<T> patch)
    {
        if (!_items.TryGetValue(id, out var current)) return default;
        patch(current);
        return current;
    }

    public List<T> Where(Func<T, bool>? predicate = null) =>
        predicate is null ? _items.Values.ToList() : _items.Values.Where(predicate).ToList();
}

public class Settings : IIdentifiable
{
    public string Id { get; set; } = "settings";
    public bool RequireRegistration { get; set; }
}

public class MemoryStore
{
    public Collection<User> Users { get; } = new();
    public Collection<Provider> Providers { get; } = new();
    public Collection<Appointment> Appointments { get; } = new();
    public Collection<Session> Sessions { get; } = new();
    public Settings Settings { get; } = new();
}
