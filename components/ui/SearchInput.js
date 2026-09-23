import { Search } from "lucide-react";

/** Rounded search field used on admin lists. Filters as you type. */
export function SearchInput({ value, onChange, placeholder }) {
  return (
    <label className="flex h-10 w-full items-center gap-2 rounded-full border border-zinc-300 bg-white px-4 sm:w-80">
      <Search className="size-4 shrink-0 text-zinc-400" aria-hidden />
      <span className="sr-only">{placeholder}</span>
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-400"
      />
    </label>
  );
}
