import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { userService, UserSummary } from '../utils/userService';

type Props = {
  value?: string; // stored value (user _id or plain name)
  onChange: (val: string | { _id: string; fullName: string; email?: string }) => void;
  placeholder?: string;
};

export default function InvigilatorSelect({ value, onChange, placeholder }: Props) {
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [selectedLabel, setSelectedLabel] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  // Fetch user label when an id value is provided
  const { data: userById } = useQuery<UserSummary | null>({
    queryKey: ['user-by-id', value],
    queryFn: () => (value ? userService.getUserById(value) : Promise.resolve(null)),
    enabled: !!value,
    staleTime: 1000 * 60,
  });

  useEffect(() => {
    if (userById && userById.fullName) setSelectedLabel(userById.fullName);
  }, [userById]);

  const { data: users = [], isFetching } = useQuery<UserSummary[]>({
    queryKey: ['search-users', debounced],
    queryFn: () => userService.searchUsers(debounced, 'lecturer'),
    enabled: debounced.length > 0,
    staleTime: 1000 * 60,
  });

  const displayValue = q !== '' ? q : (selectedLabel || '');

  return (
    <div className="relative">
      <div className="relative">
        <input
          className="input w-full"
          placeholder={placeholder || 'Search lecturer by name...'}
          value={displayValue}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
          <Search size={16} />
        </div>
      </div>

      {debounced.length > 0 && (
        <div className="absolute z-40 mt-1 w-full bg-white border border-slate-200 rounded shadow-sm max-h-56 overflow-auto">
          {isFetching ? (
            <div className="p-3 text-sm text-slate-500">Searching…</div>
          ) : users.length === 0 ? (
            <div className="p-3 text-sm text-slate-500">No lecturers found</div>
          ) : (
            users.map(u => (
              <button
                key={u._id}
                type="button"
                onClick={() => {
                      // Pass the full user object so caller can access email without extra fetch
                      onChange(u);
                      setQ('');
                      setDebounced('');
                      setSelectedLabel(u.fullName);
                    }}
                className="w-full text-left px-3 py-2 hover:bg-slate-50"
              >
                <div className="text-sm font-medium text-slate-800">{u.fullName}</div>
                <div className="text-xs text-slate-400">{u.email}</div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
