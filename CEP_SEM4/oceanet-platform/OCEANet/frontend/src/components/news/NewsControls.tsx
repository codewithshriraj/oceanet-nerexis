type Props = {
  search: string;
  setSearch: (value: string) => void;
  category: string;
  setCategory: (value: string) => void;
  sortBy: string;
  setSortBy: (value: string) => void;
  region: string;
  setRegion: (value: string) => void;
  categories: string[];
  regions: string[];
};

export default function NewsControls({
  search,
  setSearch,
  category,
  setCategory,
  sortBy,
  setSortBy,
  region,
  setRegion,
  categories,
  regions,
}: Props) {
  return (
    <section className="glass rounded-xl p-4 border border-primary/10">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search ocean news..."
          className="w-full rounded-lg border border-primary/20 bg-white px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-bioluminescent/40"
        />

        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className="w-full rounded-lg border border-primary/20 bg-white px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-bioluminescent/40"
        >
          <option value="All">All Categories</option>
          {categories.map((entry) => (
            <option key={entry} value={entry}>
              {entry}
            </option>
          ))}
        </select>

        <select
          value={region}
          onChange={(event) => setRegion(event.target.value)}
          className="w-full rounded-lg border border-primary/20 bg-white px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-bioluminescent/40"
        >
          <option value="All">All Regions</option>
          {regions.map((entry) => (
            <option key={entry} value={entry}>
              {entry}
            </option>
          ))}
        </select>

        <select
          value={sortBy}
          onChange={(event) => setSortBy(event.target.value)}
          className="w-full rounded-lg border border-primary/20 bg-white px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-bioluminescent/40"
        >
          <option value="latest">Latest</option>
          <option value="trending">Trending</option>
          <option value="region">Region</option>
        </select>
      </div>
    </section>
  );
}
