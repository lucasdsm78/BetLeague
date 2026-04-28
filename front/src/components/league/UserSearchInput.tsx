import React, { useState, useCallback, useEffect, useRef, memo } from 'react';
import { searchUsers } from '../../services/api/users';
import type { UserSearchResult } from 'types/entities/userSearch';
import './UserSearchInput.css';

interface UserSearchInputProps {
  onUserSelect: (user: UserSearchResult) => void;
  placeholder?: string;
  disabled?: boolean;
  excludeUserIds?: number[];
}

const UserSearchInput: React.FC<UserSearchInputProps> = memo(({
  onUserSelect,
  placeholder = "Rechercher un utilisateur...",
  disabled = false,
  excludeUserIds = []
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced search function
  const performSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const users = await searchUsers(searchQuery);

      // Filter out excluded users
      const filteredResults = users.filter(
        user => !excludeUserIds.includes(user.id)
      );

      setResults(filteredResults);
      setIsOpen(true);
      setSelectedIndex(-1);

    } catch (err: any) {
      console.error('❌ Search error:', err);
      setError(err?.message || 'Erreur réseau lors de la recherche');
      setResults([]);
      setIsOpen(true);
    } finally {
      setIsLoading(false);
    }
  }, [excludeUserIds]);

  // Handle input change with debouncing
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Set new debounce
    debounceRef.current = setTimeout(() => {
      performSearch(value);
    }, 300);
  }, [performSearch]);

  // Handle user selection
  const handleUserSelect = useCallback((user: UserSearchResult) => {
    onUserSelect(user);
    setQuery(user.pseudo);
    setIsOpen(false);
    setSelectedIndex(-1);
    searchInputRef.current?.blur();
  }, [onUserSelect]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < results.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev > 0 ? prev - 1 : results.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          handleUserSelect(results[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSelectedIndex(-1);
        searchInputRef.current?.blur();
        break;
    }
  }, [isOpen, results, selectedIndex, handleUserSelect]);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        resultsRef.current &&
        !resultsRef.current.contains(event.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // Clear search
  const handleClear = useCallback(() => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    setSelectedIndex(-1);
    setError('');
    searchInputRef.current?.focus();
  }, []);

  return (
    <div className="user-search-container">
      <div className="user-search-input-wrapper">
        <input
          ref={searchInputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) {
              setIsOpen(true);
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          className={`user-search-input ${error ? 'error' : ''} ${isLoading ? 'loading' : ''}`}
          autoComplete="off"
          aria-label="Rechercher un utilisateur"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          role="combobox"
        />

        {/* Loading indicator */}
        {isLoading && (
          <div className="search-loading-indicator">
            <div className="loading-spinner"></div>
          </div>
        )}

        {/* Clear button */}
        {query && !isLoading && (
          <button
            type="button"
            onClick={handleClear}
            className="search-clear-btn"
            aria-label="Effacer la recherche"
          >
            ✕
          </button>
        )}

        {/* Search icon */}
        {!query && !isLoading && (
          <div className="search-icon">
            🔍
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="search-error" role="alert">
          <span className="error-icon">⚠️</span>
          {error}
        </div>
      )}

      {/* No results message */}
      {!isLoading && !error && query.length >= 2 && results.length === 0 && (
        <div className="search-no-results">
          <span className="no-results-icon">🔍</span>
          <span className="no-results-message">
            Aucun utilisateur trouvé pour "{query}"
          </span>
        </div>
      )}

      {/* Results dropdown */}
      {isOpen && results.length > 0 && (
        <div
          ref={resultsRef}
          className="user-search-results"
          role="listbox"
          aria-label="Résultats de recherche"
        >
          {results.map((user, index) => (
            <div
              key={user.id}
              className={`user-search-result ${index === selectedIndex ? 'selected' : ''}`}
              onClick={() => handleUserSelect(user)}
              role="option"
              aria-selected={index === selectedIndex}
              tabIndex={-1}
            >
              <div className="user-avatar">
                <span className="avatar-icon">👤</span>
              </div>
              <div className="user-info">
                <div className="user-pseudo">{user.pseudo}</div>
                <div className="user-email">{user.email}</div>
              </div>
              <div className="select-indicator">
                <span className="select-icon">→</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No results message */}
      {isOpen && !isLoading && results.length === 0 && query.trim().length >= 2 && (
        <div className="user-search-no-results">
          <span className="no-results-icon">🔍</span>
          <p>Aucun utilisateur trouvé</p>
          <span className="no-results-hint">Essayez un autre terme de recherche</span>
        </div>
      )}
    </div>
  );
});

UserSearchInput.displayName = 'UserSearchInput';

export default UserSearchInput;
