import React, { useState, useEffect } from 'react';
import { api } from '../api/apiClient';
import {
  X, ChevronLeft, Star, Check, Image, Shield, ChevronRight,
  Wrench, Award, Clock, MapPin, SlidersHorizontal, User
} from 'lucide-react';

// ─── Tasker List Screen ───────────────────────────────────────────────────────
function TaskerList({ serviceName, city, lat, lng, onSelectTasker, onSeeProfile, onClose, onBack }) {
  const [taskers, setTaskers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('recommended');
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState({ withinWeek: true, flexible: true, priceFilter: false });

  useEffect(() => {
    loadTaskers();
  }, [serviceName]);

  const loadTaskers = async () => {
    try {
      setLoading(true);
      const res = await api.getExecutorsByService(serviceName, city, lat, lng);
      const data = res?.data || res || [];
      setTaskers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error loading taskers:', err);
      setTaskers([]);
    } finally {
      setLoading(false);
    }
  };

  const sorted = [...taskers].sort((a, b) => {
    if (sortBy === 'price_asc') return (a.final_hourly_rate || 0) - (b.final_hourly_rate || 0);
    if (sortBy === 'price_desc') return (b.final_hourly_rate || 0) - (a.final_hourly_rate || 0);
    if (sortBy === 'rating') return (b.average_rating || 0) - (a.average_rating || 0);
    if (sortBy === 'tasks') return (b.completed_tasks_count || 0) - (a.completed_tasks_count || 0);
    // recommended: rating * tasks
    return ((b.average_rating || 0) * (b.completed_tasks_count || 1)) -
           ((a.average_rating || 0) * (a.completed_tasks_count || 1));
  });

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <button onClick={onBack} className="p-1 hover:bg-gray-100 rounded-full">
          <ChevronLeft className="w-6 h-6 text-gray-700" />
        </button>
        <h2 className="text-lg font-bold text-gray-900">Select a Tasker</h2>
        <button onClick={() => setFilterOpen(!filterOpen)} className="p-1 hover:bg-gray-100 rounded-full">
          <SlidersHorizontal className="w-6 h-6 text-gray-700" />
        </button>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 px-4 py-3 border-b overflow-x-auto">
        <button
          onClick={() => setFilters(f => ({ ...f, withinWeek: !f.withinWeek }))}
          className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
            filters.withinWeek ? 'bg-green-700 text-white' : 'border border-green-700 text-green-700'
          }`}
        >
          Within A Week
        </button>
        <button
          onClick={() => setFilters(f => ({ ...f, flexible: !f.flexible }))}
          className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
            filters.flexible ? 'bg-green-700 text-white' : 'border border-green-700 text-green-700'
          }`}
        >
          Flexible
        </button>
        <button
          onClick={() => setFilters(f => ({ ...f, priceFilter: !f.priceFilter }))}
          className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
            filters.priceFilter ? 'bg-green-700 text-white' : 'border border-green-700 text-green-700 bg-white'
          }`}
        >
          Price
        </button>
      </div>

      {/* Sort label */}
      <div className="px-4 py-2 flex items-center gap-2">
        <span className="text-xs text-gray-500">Sorted By:</span>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          className="text-xs text-gray-600 border-none bg-transparent focus:ring-0 cursor-pointer font-medium"
        >
          <option value="recommended">Recommended</option>
          <option value="rating">Rating</option>
          <option value="tasks">Most Tasks</option>
          <option value="price_asc">Price: Low to High</option>
          <option value="price_desc">Price: High to Low</option>
        </select>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-8">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <User className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-600 font-medium mb-1">No Taskers Found</p>
            <p className="text-sm text-gray-400">
              No providers match "{serviceName}" yet. Try a different keyword or proceed without selecting.
            </p>
            <button
              onClick={() => onSelectTasker(null)}
              className="mt-6 px-6 py-2.5 bg-green-600 text-white rounded-full font-medium text-sm hover:bg-green-700"
            >
              Proceed without selecting
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {sorted.map((tasker) => (
              <TaskerCard
                key={tasker.user_id}
                tasker={tasker}
                serviceName={serviceName}
                onSelect={() => onSelectTasker(tasker)}
                onSeeProfile={() => onSeeProfile(tasker)}
              />
            ))}

            {/* Trust badge */}
            <div className="mx-4 my-4 p-4 bg-gray-50 rounded-xl flex items-center gap-3">
              <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center">
                <Shield className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-sm text-gray-600">
                Always have peace of mind. All Taskers undergo ID and criminal background checks.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Single Tasker Card ───────────────────────────────────────────────────────
function TaskerCard({ tasker, serviceName, onSelect, onSeeProfile }) {
  const profile = tasker.profile || {};
  const firstName = (tasker.name || tasker.full_name || 'Tasker').split(' ')[0];
  const lastName = (tasker.name || tasker.full_name || '').split(' ').slice(1).join(' ');
  const displayName = lastName ? `${firstName} ${lastName.charAt(0)}.` : firstName;
  const rating = tasker.average_rating || 0;
  const reviewCount = tasker.total_reviews || 0;
  const tasksCount = tasker.completed_tasks_count || profile.total_jobs_completed || 0;
  const workPhotos = tasker.work_photos_count || 0;
  const hourlyRate = tasker.final_hourly_rate || 0;
  const bio = profile.bio || '';

  return (
    <div className="px-4 py-5">
      {/* Top row: avatar, name+stats, price */}
      <div className="flex gap-3 items-start">
        {/* Avatar */}
        <div className="w-16 h-16 rounded-full bg-gray-200 flex-shrink-0 overflow-hidden border-2 border-white shadow">
          {profile.avatar || tasker.avatar ? (
            <img src={profile.avatar || tasker.avatar} alt={displayName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-green-100">
              <span className="text-xl font-bold text-green-700">{firstName.charAt(0)}</span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <h3 className="text-base font-bold text-gray-900">{displayName}</h3>
            {hourlyRate > 0 && (
              <span className="text-base font-bold text-gray-900 ml-2">
                ${hourlyRate.toFixed(2)}/hr
              </span>
            )}
          </div>

          {rating > 0 && (
            <div className="flex items-center gap-1 mt-0.5">
              <Star className="w-4 h-4 text-gray-900 fill-gray-900" />
              <span className="text-sm font-medium text-gray-700">
                {rating.toFixed(1)} ({reviewCount} reviews)
              </span>
            </div>
          )}

          {tasksCount > 0 && (
            <div className="flex items-center gap-1.5 mt-1">
              <Check className="w-4 h-4 text-gray-700" />
              <span className="text-sm text-gray-700">
                {tasksCount} {serviceName ? `${serviceName} tasks` : 'tasks completed'}
              </span>
            </div>
          )}

          {workPhotos > 0 && (
            <div className="flex items-center gap-1.5 mt-1">
              <Image className="w-4 h-4 text-green-600" />
              <span className="text-sm font-semibold text-green-600">{workPhotos} work photos</span>
            </div>
          )}
        </div>
      </div>

      {/* Bio snippet + See profile */}
      {bio && (
        <div className="mt-3 bg-gray-50 rounded-xl p-3">
          <p className="text-sm text-gray-600 line-clamp-2">{bio}</p>
          <button
            onClick={onSeeProfile}
            className="text-sm font-semibold text-green-600 mt-1.5 hover:underline"
          >
            See profile
          </button>
        </div>
      )}
      {!bio && (
        <button
          onClick={onSeeProfile}
          className="text-sm font-semibold text-green-600 mt-2 hover:underline"
        >
          See profile
        </button>
      )}
    </div>
  );
}

// ─── Tasker Profile Screen ────────────────────────────────────────────────────
function TaskerProfile({ tasker, serviceName, onSelect, onBack }) {
  const [reviews, setReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [expandBio, setExpandBio] = useState(false);

  const profile = tasker.profile || {};
  const firstName = (tasker.name || tasker.full_name || 'Tasker').split(' ')[0];
  const lastName = (tasker.name || tasker.full_name || '').split(' ').slice(1).join(' ');
  const displayName = lastName ? `${firstName} ${lastName.charAt(0)}.` : firstName;
  const rating = tasker.average_rating || 0;
  const reviewCount = tasker.total_reviews || 0;
  const tasksCount = tasker.completed_tasks_count || profile.total_jobs_completed || 0;
  const hourlyRate = tasker.final_hourly_rate || 0;
  const commissionPct = tasker.commission_percentage || 0;

  useEffect(() => {
    loadReviews();
  }, [tasker.user_id]);

  const loadReviews = async () => {
    try {
      const res = await api.get(`/reviews/provider/${tasker.user_id}`);
      const data = res?.data || res;
      setReviews(data?.reviews || []);
    } catch {
      setReviews([]);
    } finally {
      setLoadingReviews(false);
    }
  };

  // Rating distribution
  const ratingDist = [5, 4, 3, 2, 1].map(stars => {
    const count = reviews.filter(r => Math.round(r.rating) === stars).length;
    const pct = reviewCount > 0 ? Math.round((count / reviewCount) * 100) : 0;
    return { stars, pct };
  });

  const photos = profile.portfolio_photos || [];
  const tools = profile.tools_equipment || [];
  const bio = profile.bio || '';

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <button onClick={onBack} className="p-1 hover:bg-gray-100 rounded-full">
          <ChevronLeft className="w-6 h-6 text-gray-700" />
        </button>
        <h2 className="text-lg font-bold text-gray-900">Tasker Profile</h2>
        <div className="w-8" />
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto pb-20">
        {/* Basic info */}
        <div className="px-4 pt-5 pb-4">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-gray-200 overflow-hidden flex-shrink-0 border-2 border-white shadow-md">
              {profile.avatar || tasker.avatar ? (
                <img src={profile.avatar || tasker.avatar} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-green-100">
                  <span className="text-2xl font-bold text-green-700">{firstName.charAt(0)}</span>
                </div>
              )}
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{displayName}</h1>
          </div>

          <div className="mt-3 space-y-2">
            {rating > 0 && (
              <div className="flex items-center gap-1.5">
                <Star className="w-5 h-5 text-gray-900 fill-gray-900" />
                <span className="text-sm font-medium text-gray-700">
                  {rating.toFixed(1)} ({reviewCount} reviews)
                </span>
              </div>
            )}

            {tasksCount > 0 && (
              <div className="flex items-center gap-2">
                <Check className="w-5 h-5 text-green-600" strokeWidth={2.5} />
                <div>
                  <span className="text-sm font-semibold text-green-700">
                    {tasksCount} {serviceName ? `${serviceName} tasks` : 'tasks completed'}
                  </span>
                </div>
              </div>
            )}

            {tools.length > 0 && (
              <div className="flex items-start gap-2">
                <Wrench className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-gray-600">Tools: {tools.join(', ')}</span>
              </div>
            )}

            {commissionPct > 0 && (
              <p className="text-xs text-gray-400">
                Rate includes {commissionPct}% platform fee
              </p>
            )}
          </div>
        </div>

        <div className="border-t" />

        {/* Skills & Experience */}
        {bio && (
          <div className="px-4 py-4">
            <h3 className="text-base font-bold text-gray-900 mb-2">Skills & experience</h3>
            <p className={`text-sm text-gray-600 leading-relaxed ${!expandBio ? 'line-clamp-3' : ''}`}>
              {bio}
            </p>
            {bio.length > 150 && (
              <button
                onClick={() => setExpandBio(!expandBio)}
                className="text-sm font-semibold text-green-600 mt-1"
              >
                {expandBio ? 'Show less' : 'Read more'}
              </button>
            )}
          </div>
        )}

        {/* Work Photos */}
        {photos.length > 0 && (
          <>
            <div className="border-t" />
            <div className="px-4 py-4">
              <h3 className="text-base font-bold text-gray-900 mb-3">Photos</h3>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {photos.map((photo, i) => (
                  <div key={i} className="w-28 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
                    <img src={photo} alt={`Work ${i + 1}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Ratings & Reviews */}
        <div className="border-t" />
        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold text-gray-900">Ratings & reviews</h3>
            <button className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-full text-xs font-medium text-gray-600 hover:bg-gray-50">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              All {serviceName || 'Tasks'}
            </button>
          </div>

          {reviewCount > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-1 mb-3">
                <Star className="w-5 h-5 text-gray-900 fill-gray-900" />
                <span className="text-base font-bold text-gray-900">
                  {rating.toFixed(1)} ({reviewCount} ratings)
                </span>
              </div>
              <div className="space-y-1.5">
                {ratingDist.map(({ stars, pct }) => (
                  <div key={stars} className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-green-700 w-10">{stars} star</span>
                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-700 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-500 w-10 text-right">{pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Individual reviews */}
          {loadingReviews ? (
            <div className="flex justify-center py-4">
              <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : reviews.length > 0 ? (
            <div className="space-y-4">
              {reviews.slice(0, 10).map((review, i) => (
                <ReviewItem key={review.review_id || i} review={review} serviceName={serviceName} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-2">No reviews yet</p>
          )}
        </div>
      </div>

      {/* Sticky footer: price + select */}
      <div className="absolute bottom-0 left-0 right-0 bg-white border-t px-4 py-3 flex items-center gap-3">
        {hourlyRate > 0 && (
          <div>
            <span className="text-base font-bold text-gray-900">${hourlyRate.toFixed(2)}/hr</span>
          </div>
        )}
        <button
          onClick={() => onSelect(tasker)}
          className="flex-1 py-3 bg-green-600 text-white rounded-full font-semibold text-base hover:bg-green-700 transition-colors"
        >
          Select
        </button>
      </div>
    </div>
  );
}

// ─── Single Review ────────────────────────────────────────────────────────────
function ReviewItem({ review, serviceName }) {
  const clientName = review.client_name || 'Client';
  const initials = clientName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const date = review.created_at
    ? new Date(review.created_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : '';

  return (
    <div className="pb-4 border-b last:border-b-0">
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-9 h-9 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-bold text-gray-600">{initials || '?'}</span>
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">{clientName}</span>
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 text-gray-900 fill-gray-900" />
              <span className="text-sm text-gray-700">{review.rating?.toFixed(1)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {serviceName && (
              <span className="text-xs bg-green-700 text-white px-2 py-0.5 rounded font-medium uppercase tracking-wide">
                {serviceName}
              </span>
            )}
            {date && <span className="text-xs text-gray-400">{date}</span>}
          </div>
        </div>
      </div>
      {review.comment && (
        <p className="text-sm text-gray-600 leading-relaxed ml-11">{review.comment}</p>
      )}
    </div>
  );
}

// ─── Main Export: wraps both screens ─────────────────────────────────────────
export function SelectTaskerModal({ isOpen, onClose, serviceName, city, lat, lng, onTaskerSelected, onBack }) {
  const [screen, setScreen] = useState('list'); // 'list' | 'profile'
  const [selectedProfile, setSelectedProfile] = useState(null);

  if (!isOpen) return null;

  const handleSeeProfile = (tasker) => {
    setSelectedProfile(tasker);
    setScreen('profile');
  };

  const handleSelectTasker = (tasker) => {
    onTaskerSelected(tasker);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col" style={{ maxWidth: '480px', margin: '0 auto' }}>
      {screen === 'list' && (
        <TaskerList
          serviceName={serviceName}
          city={city}
          lat={lat}
          lng={lng}
          onSelectTasker={handleSelectTasker}
          onSeeProfile={handleSeeProfile}
          onClose={onClose}
          onBack={onBack}
        />
      )}
      {screen === 'profile' && selectedProfile && (
        <TaskerProfile
          tasker={selectedProfile}
          serviceName={serviceName}
          onSelect={handleSelectTasker}
          onBack={() => setScreen('list')}
        />
      )}
    </div>
  );
}
