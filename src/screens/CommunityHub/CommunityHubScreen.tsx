import React, { useState } from 'react';
import {
  MessageSquare,
  ThumbsUp,
  Share2,
  Users,
  TrendingUp,
  Sparkles,
  MapPin,
  Send,
  Plus
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';

export interface CommunityHubScreenProps {
  navigate: (route: string) => void;
}

export const CommunityHubScreen: React.FC<CommunityHubScreenProps> = ({ navigate }) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [posts, setPosts] = useState([
    {
      id: 'p1',
      author: 'Vikram S.',
      ward: 'Ward 45 (Central Zone)',
      time: '1 hour ago',
      title: 'Pedestrian safety improved after 5th Main streetlight fix!',
      content:
        'Huge thanks to the 24 residents who supported CPR-2026-000123. The Electrical Dept crew replaced the luminaire in under 48 hours. The dark corner near the bus stop is now fully illuminated.',
      likes: 38,
      comments: 6,
      category: 'Success Story'
    },
    {
      id: 'p2',
      author: 'Anita R.',
      ward: 'Ward 12 (North)',
      time: '3 hours ago',
      title: 'Coordinating support for the St. Joseph School manhole repair',
      content:
        'We noticed CPR-2026-000092 was flagged Critical. Let us ensure all parents upvote so roads and water dispatch can replace the broken concrete slab before Monday school reopens.',
      likes: 54,
      comments: 12,
      category: 'Neighborhood Action'
    },
    {
      id: 'p3',
      author: 'Kavita D.',
      ward: 'Ward 18 (East)',
      time: '6 hours ago',
      title: 'Community cleanup drive this Saturday at Russell Market',
      content:
        'Alongside the official waste department collection bins, volunteers are meeting at 9 AM to clear the sidewalk corridor. Gloves and trash bags provided!',
      likes: 29,
      comments: 4,
      category: 'Community Event'
    }
  ]);

  const [newPostText, setNewPostText] = useState('');
  const [newPostTitle, setNewPostTitle] = useState('');
  const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>({});

  const handleLike = (id: string) => {
    const isLiked = likedPosts[id];
    setLikedPosts({ ...likedPosts, [id]: !isLiked });
    setPosts(
      posts.map((p) =>
        p.id === id ? { ...p, likes: p.likes + (isLiked ? -1 : 1) } : p
      )
    );
  };

  const handleCreatePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostTitle.trim() || !newPostText.trim()) return;

    const newPost = {
      id: `p-${Date.now()}`,
      author: user ? user.name : 'Ramesh Kumar',
      ward: 'Ward 45 (Central)',
      time: 'Just now',
      title: newPostTitle.trim(),
      content: newPostText.trim(),
      likes: 1,
      comments: 0,
      category: 'Resident Discussion'
    };

    setPosts([newPost, ...posts]);
    setNewPostTitle('');
    setNewPostText('');
    showToast('Community post published to neighbourhood feed!', 'success');
  };

  return (
    <div className="min-h-screen bg-[#F7F7F1] py-10 px-4 sm:px-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <span className="text-xs font-bold text-[#174B38] uppercase tracking-wider bg-[#EAF2EB] px-3.5 py-1 rounded-full">
          Neighbourhood Engagement
        </span>
        <h1 className="text-3xl sm:text-4xl font-serif font-bold text-[#25312B] mt-2">
          Community Hub & Discussions
        </h1>
        <p className="text-sm text-[#7D8981] mt-1">
          Connect with active residents, organize neighbourhood cleanups, and celebrate verified resolutions.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Main Feed Column */}
        <div className="lg:col-span-8 space-y-6">
          {/* Create Post Box */}
          <div className="bg-white rounded-3xl border border-[#EAF2EB] p-6 shadow-card space-y-4">
            <h3 className="font-display font-bold text-base text-[#25312B] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#FF873E]" />
              <span>Share an update with your neighbourhood</span>
            </h3>

            <form onSubmit={handleCreatePost} className="space-y-3">
              <input
                type="text"
                value={newPostTitle}
                onChange={(e) => setNewPostTitle(e.target.value)}
                placeholder="Topic or heading (e.g. Update on local park cleanup)..."
                className="w-full h-11 px-4 rounded-xl border border-[#EAF2EB] bg-[#F7F7F1]/50 text-sm text-[#25312B] focus:outline-none focus:border-[#174B38]"
              />

              <textarea
                rows={3}
                value={newPostText}
                onChange={(e) => setNewPostText(e.target.value)}
                placeholder="Share your thoughts, coordinate support, or discuss local improvements..."
                className="w-full p-4 rounded-xl border border-[#EAF2EB] bg-[#F7F7F1]/50 text-sm text-[#25312B] focus:outline-none focus:border-[#174B38]"
              />

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="bg-[#174B38] hover:bg-[#11392A] text-white px-6 py-2.5 rounded-full font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Post to Community</span>
                </button>
              </div>
            </form>
          </div>

          {/* Posts Feed */}
          <div className="space-y-4">
            {posts.map((post) => (
              <div
                key={post.id}
                className="bg-white rounded-3xl border border-[#EAF2EB] p-6 shadow-xs hover:shadow-card transition-all space-y-3"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-[#EAF2EB] text-[#174B38] font-bold text-sm flex items-center justify-center">
                      {post.author.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-[#25312B]">{post.author}</p>
                      <p className="text-[11px] text-[#7D8981] flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-[#174B38]" /> {post.ward} · {post.time}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-[#B93E16] bg-[#FFF1E6] px-2.5 py-0.5 rounded-full">
                    {post.category}
                  </span>
                </div>

                <h3 className="font-display font-bold text-lg text-[#25312B]">{post.title}</h3>

                <p className="text-sm text-[#25312B]/90 leading-relaxed">{post.content}</p>

                <div className="pt-3 border-t border-[#F5F7F1] flex items-center gap-4 text-xs font-semibold text-[#7D8981]">
                  <button
                    onClick={() => handleLike(post.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full cursor-pointer transition-colors ${
                      likedPosts[post.id]
                        ? 'bg-[#FFF1E6] text-[#E65D25]'
                        : 'hover:bg-[#F7F7F1] text-[#7D8981]'
                    }`}
                  >
                    <ThumbsUp className={`w-3.5 h-3.5 ${likedPosts[post.id] ? 'fill-[#E65D25]' : ''}`} />
                    <span>{post.likes}</span>
                  </button>

                  <span className="flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>{post.comments} comments</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Sidebar: Trending Topics and Community Members */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-3xl border border-[#EAF2EB] p-6 shadow-card space-y-4">
            <h3 className="font-display font-bold text-base text-[#25312B] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#E65D25]" />
              <span>Trending Civic Discussions</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-[#F7F7F1] hover:bg-[#EAF2EB] transition-colors cursor-pointer">
                <p className="font-bold text-[#25312B]">#StreetlightRestoration</p>
                <p className="text-[#7D8981] mt-0.5">84 active reports across Ward 45 & 33</p>
              </div>

              <div className="p-3 rounded-xl bg-[#F7F7F1] hover:bg-[#EAF2EB] transition-colors cursor-pointer">
                <p className="font-bold text-[#25312B]">#PotholeRepairDrive</p>
                <p className="text-[#7D8981] mt-0.5">42 residents tracking MG Road flyover</p>
              </div>

              <div className="p-3 rounded-xl bg-[#F7F7F1] hover:bg-[#EAF2EB] transition-colors cursor-pointer">
                <p className="font-bold text-[#25312B]">#SafeSchoolsPathway</p>
                <p className="text-[#7D8981] mt-0.5">Focus on covered storm drains and pedestrian crosswalks</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl gradient-soft p-6 border border-[#91B69C]/30 space-y-3">
            <div className="flex items-center gap-2 text-[#174B38] font-bold text-sm">
              <Users className="w-4 h-4" />
              <span>Community Impact Leaderboard</span>
            </div>
            <p className="text-xs text-[#7D8981]">
              Over 12,450 residents are actively collaborating across 48 neighbourhoods to make municipal resolution faster.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

