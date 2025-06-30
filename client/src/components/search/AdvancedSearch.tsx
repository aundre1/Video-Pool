import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Search, Filter, Sliders, Tag, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { Toggle } from "@/components/ui/toggle";

// Debounce hook for search input
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

interface SearchFilters {
  query: string;
  categoryId?: number | number[];
  tags?: string[];
  bpmRange?: { min: number; max: number };
  artist?: string;
  year?: number | { min: number; max: number };
  resolution?: string | string[];
  isPremium?: boolean;
  isLoop?: boolean;
  sortBy: string;
  page: number;
  limit: number;
}

interface AdvancedSearchProps {
  onSearch: (results: any) => void;
  initialQuery?: string;
  showFilters?: boolean;
}

export default function AdvancedSearch({
  onSearch,
  initialQuery = "",
  showFilters = false,
}: AdvancedSearchProps) {
  // Search state
  const [query, setQuery] = useState(initialQuery);
  const debouncedQuery = useDebounce(query, 300);
  const [searchOpen, setSearchOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(showFilters);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [popularTerms, setPopularTerms] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [bpmRange, setBpmRange] = useState<[number, number]>([90, 140]);
  const [selectedResolutions, setSelectedResolutions] = useState<string[]>([]);
  const [isPremium, setIsPremium] = useState<boolean | undefined>(undefined);
  const [isLoop, setIsLoop] = useState<boolean | undefined>(undefined);
  const [sortBy, setSortBy] = useState("relevance");
  const [page, setPage] = useState(1);
  const [limit] = useState(20);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Categories query for filter options
  const { data: categories } = useQuery({
    queryKey: ["/api/categories"],
    enabled: filtersOpen,
  });

  // Get autocomplete suggestions when user types
  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      const fetchSuggestions = async () => {
        try {
          const response = await apiRequest(
            "GET",
            `/api/search/autocomplete?prefix=${encodeURIComponent(
              debouncedQuery
            )}&limit=5`
          );
          const data = await response.json();
          setSuggestions(data.suggestions || []);
        } catch (error) {
          console.error("Error fetching suggestions:", error);
        }
      };

      fetchSuggestions();
    } else {
      setSuggestions([]);
    }
  }, [debouncedQuery]);

  // Get popular search terms on component mount
  useEffect(() => {
    const fetchPopularTerms = async () => {
      try {
        const response = await apiRequest(
          "GET",
          "/api/search/popular?limit=5"
        );
        const data = await response.json();
        setPopularTerms(data.terms || []);
      } catch (error) {
        console.error("Error fetching popular terms:", error);
      }
    };

    fetchPopularTerms();
  }, []);

  // Build search filters object from all selected options
  const buildSearchFilters = (): SearchFilters => {
    const filters: SearchFilters = {
      query: debouncedQuery,
      sortBy,
      page,
      limit,
    };

    if (selectedCategories.length > 0) {
      filters.categoryId =
        selectedCategories.length === 1
          ? selectedCategories[0]
          : selectedCategories;
    }

    if (selectedTags.length > 0) {
      filters.tags = selectedTags;
    }

    if (bpmRange[0] !== 90 || bpmRange[1] !== 140) {
      filters.bpmRange = { min: bpmRange[0], max: bpmRange[1] };
    }

    if (selectedResolutions.length > 0) {
      filters.resolution =
        selectedResolutions.length === 1
          ? selectedResolutions[0]
          : selectedResolutions;
    }

    if (isPremium !== undefined) {
      filters.isPremium = isPremium;
    }

    if (isLoop !== undefined) {
      filters.isLoop = isLoop;
    }

    return filters;
  };

  // Main search query
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["search", buildSearchFilters()],
    queryFn: async () => {
      // Build query string
      const params = new URLSearchParams();
      const filters = buildSearchFilters();

      if (filters.query) params.append("query", filters.query);
      
      if (filters.categoryId) {
        if (Array.isArray(filters.categoryId)) {
          params.append("categoryId", filters.categoryId.join(","));
        } else {
          params.append("categoryId", filters.categoryId.toString());
        }
      }
      
      if (filters.tags && filters.tags.length > 0)
        params.append("tags", filters.tags.join(","));
      
      if (filters.bpmRange) {
        params.append("bpmMin", filters.bpmRange.min.toString());
        params.append("bpmMax", filters.bpmRange.max.toString());
      }
      
      if (filters.resolution) {
        if (Array.isArray(filters.resolution)) {
          params.append("resolution", filters.resolution.join(","));
        } else {
          params.append("resolution", filters.resolution);
        }
      }
      
      if (filters.isPremium !== undefined)
        params.append("isPremium", filters.isPremium.toString());
      
      if (filters.isLoop !== undefined)
        params.append("isLoop", filters.isLoop.toString());
      
      params.append("sortBy", filters.sortBy);
      params.append("page", filters.page.toString());
      params.append("limit", filters.limit.toString());

      const response = await apiRequest(
        "GET",
        `/api/search?${params.toString()}`
      );
      return response.json();
    },
    enabled: debouncedQuery.length > 0 || Object.keys(buildSearchFilters()).length > 2,
  });

  // Pass search results to parent component when data changes
  useEffect(() => {
    if (data) {
      onSearch(data);
    }
  }, [data, onSearch]);

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    setSearchOpen(false);
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const handleSearch = () => {
    refetch();
    setSearchOpen(false);
  };

  const toggleCategory = (categoryId: number) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const toggleResolution = (resolution: string) => {
    setSelectedResolutions((prev) =>
      prev.includes(resolution)
        ? prev.filter((r) => r !== resolution)
        : [...prev, resolution]
    );
  };

  const clearFilters = () => {
    setSelectedCategories([]);
    setSelectedTags([]);
    setBpmRange([90, 140]);
    setSelectedResolutions([]);
    setIsPremium(undefined);
    setIsLoop(undefined);
    setSortBy("relevance");
    setPage(1);
  };

  return (
    <div className="w-full mb-8 space-y-3">
      <div className="flex flex-col md:flex-row gap-2">
        {/* Search bar with autocomplete */}
        <div className="relative flex-grow">
          <Popover open={searchOpen} onOpenChange={setSearchOpen}>
            <PopoverTrigger asChild>
              <div className="relative flex items-center">
                <Input
                  ref={searchInputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search for videos..."
                  className="pl-10 pr-4 py-2 h-12 bg-dark-card border-dark-border focus-visible:ring-primary"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSearch();
                    } else if (e.key === "ArrowDown") {
                      setSearchOpen(true);
                    }
                  }}
                  onFocus={() => {
                    if (query.length >= 2) {
                      setSearchOpen(true);
                    }
                  }}
                />
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                {query && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-1/2 transform -translate-y-1/2 h-10 w-10"
                    onClick={() => setQuery("")}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </PopoverTrigger>
            <PopoverContent
              className="w-[var(--radix-popover-trigger-width)] p-0 bg-dark-card border-dark-border"
              sideOffset={4}
            >
              <Command>
                <CommandList>
                  {suggestions.length > 0 && (
                    <CommandGroup heading="Suggestions">
                      {suggestions.map((suggestion) => (
                        <CommandItem
                          key={suggestion}
                          onSelect={() => handleSuggestionClick(suggestion)}
                        >
                          {suggestion}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                  {popularTerms.length > 0 && (
                    <CommandGroup heading="Popular Searches">
                      {popularTerms.map((term) => (
                        <CommandItem
                          key={term}
                          onSelect={() => handleSuggestionClick(term)}
                        >
                          {term}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                </CommandList>
                <CommandEmpty>No results found</CommandEmpty>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* Search Button */}
        <Button
          onClick={handleSearch}
          className="bg-primary hover:bg-primary/90 h-12"
        >
          <Search className="mr-2 h-5 w-5" />
          Search
        </Button>

        {/* Filter Toggle */}
        <Button
          variant={filtersOpen ? "secondary" : "outline"}
          className="h-12"
          onClick={() => setFiltersOpen(!filtersOpen)}
        >
          <Filter className="mr-2 h-5 w-5" />
          Filters {Object.keys(buildSearchFilters()).length > 3 && `(${Object.keys(buildSearchFilters()).length - 3})`}
        </Button>
      </div>

      {/* Advanced Filters */}
      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
        <CollapsibleContent>
          <Card className="p-4 bg-dark-card border-dark-border">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              {/* Categories */}
              <div>
                <h3 className="text-sm font-medium mb-2">Categories</h3>
                <div className="flex flex-wrap gap-2">
                  {categories?.map((category: any) => (
                    <Badge
                      key={category.id}
                      variant={
                        selectedCategories.includes(category.id)
                          ? "default"
                          : "outline"
                      }
                      className="cursor-pointer"
                      onClick={() => toggleCategory(category.id)}
                    >
                      {category.name}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Tags */}
              <div>
                <h3 className="text-sm font-medium mb-2">Popular Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {["EDM", "Hip Hop", "House", "Techno", "Trance", "Loops", "Visual FX", "Abstract"].map((tag) => (
                    <Badge
                      key={tag}
                      variant={selectedTags.includes(tag) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => toggleTag(tag)}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
                <div className="mt-2">
                  <Input
                    placeholder="Add custom tag..."
                    className="bg-dark-card border-dark-border h-8"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && e.currentTarget.value) {
                        toggleTag(e.currentTarget.value);
                        e.currentTarget.value = "";
                      }
                    }}
                  />
                </div>
              </div>

              {/* Resolution */}
              <div>
                <h3 className="text-sm font-medium mb-2">Resolution</h3>
                <div className="flex flex-wrap gap-2">
                  {["HD", "4K", "1080p", "720p"].map((resolution) => (
                    <Badge
                      key={resolution}
                      variant={
                        selectedResolutions.includes(resolution)
                          ? "default"
                          : "outline"
                      }
                      className="cursor-pointer"
                      onClick={() => toggleResolution(resolution)}
                    >
                      {resolution}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* BPM Slider */}
              <div>
                <h3 className="text-sm font-medium mb-2">
                  BPM Range: {bpmRange[0]} - {bpmRange[1]}
                </h3>
                <Slider
                  defaultValue={bpmRange}
                  min={60}
                  max={180}
                  step={1}
                  onValueChange={(value: [number, number]) => setBpmRange(value)}
                  className="my-4"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {/* Premium Toggle */}
              <div>
                <h3 className="text-sm font-medium mb-2">Premium</h3>
                <ToggleGroup type="single" value={isPremium?.toString()} onValueChange={(value) => setIsPremium(value === 'true' ? true : value === 'false' ? false : undefined)}>
                  <ToggleGroupItem value="true">Premium Only</ToggleGroupItem>
                  <ToggleGroupItem value="false">Free Only</ToggleGroupItem>
                  <ToggleGroupItem value="">All</ToggleGroupItem>
                </ToggleGroup>
              </div>

              {/* Loop Toggle */}
              <div>
                <h3 className="text-sm font-medium mb-2">Loop Type</h3>
                <ToggleGroup type="single" value={isLoop?.toString()} onValueChange={(value) => setIsLoop(value === 'true' ? true : value === 'false' ? false : undefined)}>
                  <ToggleGroupItem value="true">Loops Only</ToggleGroupItem>
                  <ToggleGroupItem value="false">Non-Loops</ToggleGroupItem>
                  <ToggleGroupItem value="">All</ToggleGroupItem>
                </ToggleGroup>
              </div>

              {/* Sort By */}
              <div>
                <h3 className="text-sm font-medium mb-2">Sort By</h3>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="bg-dark-card border-dark-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-dark-card border-dark-border">
                    <SelectItem value="relevance">Relevance</SelectItem>
                    <SelectItem value="newest">Newest</SelectItem>
                    <SelectItem value="popular">Most Popular</SelectItem>
                    <SelectItem value="title_asc">Title (A-Z)</SelectItem>
                    <SelectItem value="title_desc">Title (Z-A)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Filter Actions */}
            <div className="flex justify-between mt-2">
              <Button variant="outline" onClick={clearFilters}>
                Clear Filters
              </Button>
              <Button onClick={handleSearch}>
                Apply Filters
              </Button>
            </div>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Search Status Message */}
      {isLoading && (
        <div className="text-center py-4">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent align-middle"></div>
          <span className="ml-2">Searching...</span>
        </div>
      )}

      {/* Selected Filters Display */}
      {!isLoading && data && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>Found {data.total} results</span>
          {selectedCategories.length > 0 && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <span>
                {selectedCategories.length} {selectedCategories.length === 1 ? 'category' : 'categories'}
              </span>
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => setSelectedCategories([])}
              />
            </Badge>
          )}
          {selectedTags.length > 0 && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <span>
                {selectedTags.length} {selectedTags.length === 1 ? 'tag' : 'tags'}
              </span>
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => setSelectedTags([])}
              />
            </Badge>
          )}
          {sortBy !== "relevance" && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <span>
                Sorted by: {sortBy.replace("_", " ")}
              </span>
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => setSortBy("relevance")}
              />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}