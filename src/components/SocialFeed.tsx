import { useEffect, useState, useCallback } from 'react'
import { StorageService } from '../lib/storage'
import { MessageSquare, Send } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { Post, Reaction } from '../types'
import type { Session } from '@supabase/supabase-js'

interface SocialFeedProps {
  session: Session | null
}

export function SocialFeed({ session }: SocialFeedProps) {
  const [posts, setPosts] = useState<Post[]>([])
  const [newPostContent, setNewPostContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [commentingOn, setCommentingOn] = useState<string | null>(null)
  const [newComment, setNewComment] = useState('')

  const fetchPosts = useCallback(async () => {
    try {
      const data = await StorageService.fetchPosts()
      setPosts(data)
    } catch (err) {
      console.error('Error fetching posts:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let mounted = true
    if (mounted) {
      fetchPosts()
    }
    return () => { mounted = false }
  }, [fetchPosts])

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPostContent.trim() || !session) return
    try {
      await StorageService.createPost(newPostContent, session.user.id)
      setNewPostContent('')
      fetchPosts()
    } catch (err: any) {
      console.error('Error creating post:', err)
      alert(`TRANSMISSION_ERROR: ${err.message || 'Check if posts table exists'}`)
    }
  }

  const handleAddComment = async (postId: string) => {
    if (!newComment.trim() || !session) return
    try {
      await StorageService.addComment(postId, newComment, session.user.id)
      setNewComment('')
      setCommentingOn(null)
      fetchPosts()
    } catch (err) {
      console.error('Error adding comment:', err)
    }
  }

  const handleToggleReaction = async (postId: string, emoji: string) => {
    if (!session) return
    try {
      await StorageService.toggleReaction(postId, emoji, session.user.id)
      fetchPosts()
    } catch (err) {
      console.error('Error toggling reaction:', err)
    }
  }

  if (loading) return <div className="text-center py-20 text-[10px] uppercase tracking-widest text-gray-500">Connecting_to_Neural_Feed...</div>

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <section className="space-y-4">
        <h2 className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-bold">Community_Pulse</h2>
        {session ? (
          <form onSubmit={handleCreatePost} className="space-y-3">
            <textarea
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              placeholder="SHARE_ACHIEVEMENT_OR_THOUGHT..."
              className="w-full bg-gray-950 border border-gray-900 p-4 text-xs font-mono text-gray-300 focus:outline-none focus:border-cyan-500 h-24 resize-none"
            />
            <div className="flex justify-end">
              <button 
                type="submit" 
                className="flex items-center gap-2 bg-white text-black px-4 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-cyan-500 hover:text-white transition-all"
              >
                <Send size={12} />
                Transmit
              </button>
            </div>
          </form>
        ) : (
          <div className="p-8 border border-dashed border-gray-900 text-center space-y-2">
            <p className="text-[10px] text-gray-600 uppercase tracking-widest">Login to participate in community discussion</p>
          </div>
        )}
      </section>

      <div className="space-y-6">
        {posts.map((post) => (
          <div key={post.id} className="bg-gray-950 border border-gray-900 p-6 space-y-4">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-900 border border-gray-800 flex items-center justify-center text-[10px] font-bold text-cyan-500 uppercase">
                  {post.profiles?.username?.[0]}
                </div>
                <div>
                  <p className="text-xs font-bold text-white uppercase tracking-tighter">{post.profiles?.username}</p>
                  <p className="text-[8px] text-gray-600 uppercase font-bold">
                    {formatDistanceToNow(new Date(post.created_at))} ago
                  </p>
                </div>
              </div>
              {post.type === 'milestone' && (
                <span className="px-2 py-0.5 bg-orange-500/10 text-orange-500 border border-orange-500/30 text-[8px] font-bold uppercase tracking-widest">
                  Milestone
                </span>
              )}
            </div>

            <p className="text-sm text-gray-300 leading-relaxed font-mono">{post.content}</p>

            <div className="flex gap-4 border-t border-gray-900 pt-4">
              <button 
                onClick={() => handleToggleReaction(post.id, '🔥')}
                className={`flex items-center gap-1 text-[10px] font-bold transition-colors ${post.reactions?.some((r: Reaction) => r.user_id === session?.user?.id && r.emoji === '🔥') ? 'text-orange-500' : 'text-gray-600 hover:text-orange-400'}`}
              >
                🔥 <span className="text-[8px]">{post.reactions?.filter((r: Reaction) => r.emoji === '🔥').length || 0}</span>
              </button>
              <button 
                onClick={() => handleToggleReaction(post.id, '👏')}
                className={`flex items-center gap-1 text-[10px] font-bold transition-colors ${post.reactions?.some((r: Reaction) => r.user_id === session?.user?.id && r.emoji === '👏') ? 'text-cyan-400' : 'text-gray-600 hover:text-cyan-300'}`}
              >
                👏 <span className="text-[8px]">{post.reactions?.filter((r: Reaction) => r.emoji === '👏').length || 0}</span>
              </button>
              <button 
                onClick={() => setCommentingOn(commentingOn === post.id ? null : post.id)}
                className="flex items-center gap-1 text-[10px] font-bold text-gray-600 hover:text-white transition-colors"
              >
                <MessageSquare size={12} />
                <span className="text-[8px]">{post.comments?.length || 0}</span>
              </button>
            </div>

            {(post.comments?.length || 0) > 0 && (
              <div className="space-y-3 pl-4 border-l border-gray-900 mt-4">
                {post.comments?.map((comment) => (
                  <div key={comment.id} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold text-cyan-600 uppercase">{comment.profiles?.username}</span>
                      <span className="text-[7px] text-gray-700 font-bold uppercase">{formatDistanceToNow(new Date(comment.created_at))} ago</span>
                    </div>
                    <p className="text-[11px] text-gray-400 font-mono">{comment.content}</p>
                  </div>
                ))}
              </div>
            )}

            {commentingOn === post.id && (
              <div className="flex gap-2 pt-2">
                <input
                  autoFocus
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="ADD_COMMENT..."
                  className="flex-1 bg-black border border-gray-900 px-3 py-1 text-[10px] font-mono text-gray-400 focus:outline-none focus:border-cyan-500"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddComment(post.id)}
                />
                <button 
                  onClick={() => handleAddComment(post.id)}
                  className="text-white hover:text-cyan-500 transition-colors"
                >
                  <Send size={14} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
