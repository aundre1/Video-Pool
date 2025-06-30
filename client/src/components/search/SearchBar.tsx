import { useState, FormEvent } from "react";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import VoiceSearch from "./VoiceSearch";

interface SearchBarProps {
  defaultValue?: string;
  placeholder?: string;
  className?: string;
  onSearch?: (query: string) => void;
  searchRoute?: string;
}

/**
 * Modern search bar with voice search integration
 * For TheVideoPool 2025 UX Enhancement
 */
const SearchBar = ({
  defaultValue = "",
  placeholder = "Search videos...",
  className = "",
  onSearch,
  searchRoute = "/browse"
}: SearchBarProps) => {
  const [query, setQuery] = useState(defaultValue);
  const [location, setLocation] = useLocation();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    
    if (!query.trim()) return;
    
    if (onSearch) {
      onSearch(query.trim());
    } else {
      setLocation(`${searchRoute}?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const handleVoiceSearch = (voiceQuery: string) => {
    setQuery(voiceQuery);
    
    if (onSearch) {
      onSearch(voiceQuery);
    } else {
      setLocation(`${searchRoute}?q=${encodeURIComponent(voiceQuery)}`);
    }
  };

  return (
    <form 
      onSubmit={handleSubmit} 
      className={`relative flex items-center w-full max-w-md ${className}`}
    >
      <Input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="pr-24 rounded-full border-gray-700 bg-black/20 backdrop-blur-sm focus-visible:ring-purple-500"
        aria-label="Search videos"
      />
      <div className="absolute right-2 flex items-center space-x-1">
        <Button 
          type="submit" 
          size="icon" 
          variant="ghost"
          className="h-8 w-8 text-gray-400 hover:text-white hover:bg-gray-800"
        >
          <Search className="h-4 w-4" />
          <span className="sr-only">Search</span>
        </Button>
        <VoiceSearch 
          onSearch={handleVoiceSearch} 
          placeholder="Say what you want to search for..."
        />
      </div>
    </form>
  );
};

export default SearchBar;