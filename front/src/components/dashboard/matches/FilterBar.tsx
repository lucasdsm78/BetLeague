import React, { memo } from 'react';

interface SortOption {
  value: string;
  label: string;
}

export const SORT_OPTIONS: SortOption[] = [
  { value: 'kickoff', label: 'Heure de début' },
  { value: 'trending', label: 'Populaires' },
  { value: 'odds', label: 'Meilleures cotes' },
];

export const COMPETITIONS = ['Tous', 'Ligue 1', 'Premier League', 'La Liga', 'Bundesliga', 'Champions League'];

export interface FilterBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  selectedCompetition: string;
  onCompetitionChange: (value: string) => void;
  sortBy: string;
  onSortChange: (value: string) => void;
}

const FilterBar = memo<FilterBarProps>(function FilterBar({
  searchTerm,
  onSearchChange,
  selectedCompetition,
  onCompetitionChange,
  sortBy,
  onSortChange,
}) {
  return (
    <div className="filter-bar">
      <div className="search-input">
        <input
          type="text"
          placeholder="Rechercher équipes..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="search-field"
          autoComplete="off"
          inputMode="search"
        />
        <span className="search-icon">🔍</span>
      </div>

      <div className="filter-controls">
        <select
          value={selectedCompetition}
          onChange={(e) => onCompetitionChange(e.target.value)}
          className="competition-select"
        >
          {COMPETITIONS.map((comp) => (
            <option key={comp} value={comp}>
              {comp}
            </option>
          ))}
        </select>

        <select value={sortBy} onChange={(e) => onSortChange(e.target.value)} className="sort-select">
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
});

export default FilterBar;

