import { useEffect, useState, useCallback } from 'react'
import { StorageService } from '../lib/storage'
import { MessageSquare, Send, Trash2, Plus, Globe, Pencil, X, Check } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { Post, Reaction } from '../types'
import type { Session } from '@supabase/supabase-js'
import { useTranslation } from '../lib/i18n'
import { EmptyState } from './EmptyState'

interface SocialFeedProps {
  session: Session | null
  onShareStreak: () => void
  dailyStreak: number
  groupId?: string
  onSelectUser?: (userId: string) => void
}

export function SocialFeed({ session, onShareStreak, dailyStreak, groupId, onSelectUser }: SocialFeedProps) {
  const { t } = useTranslation();

  const [posts, setPosts] = useState<Post[]>([])
  const [newPostContent, setNewPostContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [commentingOn, setCommentingOn] = useState<string | null>(null)
  const [newComment, setNewComment] = useState('')
  const [editingPostId, setEditingPostId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [viewingReactions, setViewingReactions] = useState<Post | null>(null)

  const fetchPosts = useCallback(async () => {
    try {
      const data = await StorageService.fetchPosts(groupId)
      setPosts(data)
    } catch (err: any) {
      console.error('Error fetching posts:', err)
      alert(`FEED_SYNC_ERROR: ${err.message || 'Check connection'}. Make sure your database schema is up to date (run supabase_schema.sql).`)
    } finally {
      setLoading(false)
    }
  }, [groupId])

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
      await StorageService.createPost(newPostContent, session.user.id, 'manual', {}, groupId)
      setNewPostContent('')
      fetchPosts()
    } catch (err: any) {
      console.error('Error creating post:', err)
      alert(`TRANSMISSION_ERROR: ${err.message || 'Check if posts table exists'}`)
    }
  }

  const handleAddComment = async (postId: string) => {
    if (!newComment.trim() || !session) return
    
    const content = newComment
    setNewComment('')
    setCommentingOn(null)

    try {
      await StorageService.addComment(postId, content, session.user.id)
      fetchPosts() // Sync with server
    } catch (err) {
      console.error('Error adding comment:', err)
      setNewComment(content) // Restore on failure
    }
  }

  const handleToggleReaction = async (postId: string, emoji: string) => {
    if (!session) return

    // Optimistic Update
    const oldPosts = [...posts]
    setPosts(posts.map(post => {
      if (post.id !== postId) return post
      
      const reactions = post.reactions || []
      const existing = reactions.find(r => r.user_id === session.user.id && r.emoji === emoji)
      
      if (existing) {
        return { ...post, reactions: reactions.filter(r => r.id !== existing.id) }
      } else {
        return { ...post, reactions: [...reactions, { id: 'temp', post_id: postId, user_id: session.user.id, emoji }] }
      }
    }))

    try {
      await StorageService.toggleReaction(postId, emoji, session.user.id)
      fetchPosts() // Sync actual IDs from server
    } catch (err: any) {
      console.error('Error toggling reaction:', err)
      setPosts(oldPosts) // Rollback
    }
  }

  const handleDeletePost = async (postId: string) => {
    if (!session || !window.confirm('TERMINATE_POST: Are you sure? This action is permanent.')) return
    try {
      await StorageService.deletePost(postId)
      fetchPosts()
    } catch (err: any) {
      console.error('Error deleting post:', err)
      alert('PROTOCOL_ERROR: Post could not be terminated.')
    }
  }

  const handleUpdatePost = async (postId: string) => {
    if (!editContent.trim()) return
    try {
      await StorageService.updatePost(postId, editContent)
      setEditingPostId(null)
      fetchPosts()
    } catch (err: any) {
      console.error('Error updating post:', err)
      alert('PROTOCOL_ERROR: Update transmission failed.')
    }
  }

  if (loading) return <div className="text-center py-20 text-[10px] uppercase tracking-widest text-gray-400">{t('feed.loading')}</div>

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      {!groupId && (
        <section className="space-y-4">
          <div className="flex justify-between items-end">
            <h2 className="text-[10px] uppercase tracking-[0.3em] text-gray-400 font-bold">{t('feed.title')}</h2>
            {session && dailyStreak > 0 && (
              <button 
                onClick={onShareStreak}
                className="px-3 py-1 bg-accent/10 text-accent border border-accent/30 hover:bg-accent hover:text-white transition-all text-[8px] font-black uppercase tracking-widest flex items-center gap-2"
              >
                <Plus size={10} />
                {t('feed.share_streak')}
              </button>
            )}
          </div>
        </section>
      )}

      <section className="space-y-4">
        {session ? (
          <form onSubmit={handleCreatePost} className="space-y-3">
            <textarea
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              placeholder={t('feed.placeholder')}
              className="w-full bg-white border-2 border-border p-4 text-xs font-mono text-ink focus:outline-none focus:border-accent h-24 resize-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
            />
            <div className="flex justify-end">
              <button 
                type="submit" 
                className="flex items-center gap-2 bg-black text-white px-4 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-accent transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none border-2 border-black"
              >
                <Send size={12} />
                {t('feed.post')}
              </button>
            </div>
          </form>
        ) : (
          <div className="p-8 border border-dashed border-border text-center space-y-2 bg-white/50">
            <p className="text-[10px] text-gray-400 uppercase tracking-widest">{t('feed.login_prompt')}</p>
          </div>
        )}
      </section>

      <div className="space-y-6">
        {posts.map((post) => {
          const isMe = post.user_id === session?.user?.id
          return (
            <div key={post.id} className="bg-white border-2 border-border p-6 space-y-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(124,58,237,1)] transition-all">
              <div className="flex justify-between items-start">
                <div 
                  className={`flex items-center gap-3 group/user ${isMe ? 'cursor-default' : 'cursor-pointer'}`}
                  onClick={() => !isMe && post.user_id && onSelectUser?.(post.user_id)}
                >
                  <div className={`w-8 h-8 bg-canvas border-2 border-border flex items-center justify-center text-[10px] font-bold text-accent uppercase overflow-hidden transition-colors ${!isMe && 'group-hover/user:border-accent'}`}>
                    {post.profiles?.avatar_url ? (
                      <img src={post.profiles.avatar_url} alt={post.profiles.username} className="w-full h-full object-cover" />
                    ) : (
                      post.profiles?.username?.[0]
                    )}
                  </div>
                  <div>
                    <p className={`text-xs font-bold text-ink uppercase tracking-tighter transition-colors ${!isMe && 'group-hover/user:text-accent'}`}>{post.profiles?.username}</p>
                    <p className="text-[8px] text-gray-400 uppercase font-bold">
                      {formatDistanceToNow(new Date(post.created_at))} ago
                    </p>
                  </div>
                </div>
              {post.type === 'milestone' && (
                <span className="px-2 py-0.5 bg-accent/10 text-accent border border-accent/30 text-[8px] font-bold uppercase tracking-widest">
                  Milestone
                </span>
              )}
              {post.user_id === session?.user?.id && (
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => {
                      setEditingPostId(post.id)
                      setEditContent(post.content)
                    }}
                    className="p-2 text-gray-400 hover:text-accent transition-colors"
                    title="Edit Post"
                  >
                    <Pencil size={14} />
                  </button>
                  <button 
                    onClick={() => handleDeletePost(post.id)}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    title="Delete Post"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>

            {editingPostId === post.id ? (
              <div className="space-y-3">
                <textarea
                  autoFocus
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full bg-canvas border-2 border-accent p-3 text-sm font-mono text-ink focus:outline-none h-24 resize-none"
                />
                <div className="flex justify-end gap-2">
                  <button 
                    onClick={() => setEditingPostId(null)}
                    className="flex items-center gap-1 px-3 py-1 text-[8px] font-black uppercase tracking-widest text-gray-400 hover:text-ink transition-colors"
                  >
                    <X size={10} />
                    {t('common.cancel')}
                  </button>
                  <button 
                    onClick={() => handleUpdatePost(post.id)}
                    className="flex items-center gap-1 bg-accent text-white px-3 py-1 text-[8px] font-black uppercase tracking-widest hover:bg-accent/80 transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none border border-black"
                  >
                    <Check size={10} />
                    {t('common.save')}
                  </button>
                </div>
              </div>
            ) : (
              <p 
                onClick={() => setViewingReactions(post)}
                className="text-sm text-ink leading-relaxed font-mono whitespace-pre-wrap cursor-pointer hover:text-accent transition-colors"
              >
                {post.content}
              </p>
            )}

            <div className="flex gap-4 border-t border-border pt-4">
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => handleToggleReaction(post.id, '🔥')}
                  className={`text-[10px] font-bold transition-colors ${post.reactions?.some((r: Reaction) => r.user_id === session?.user?.id && r.emoji === '🔥') ? 'text-accent' : 'text-gray-400 hover:text-accent'}`}
                >
                  🔥
                </button>
                <button 
                  onClick={() => setViewingReactions(post)}
                  className="text-[8px] font-bold text-gray-400 hover:text-accent transition-colors"
                >
                  {post.reactions?.filter((r: Reaction) => r.emoji === '🔥').length || 0}
                </button>
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => handleToggleReaction(post.id, '👏')}
                  className={`text-[10px] font-bold transition-colors ${post.reactions?.some((r: Reaction) => r.user_id === session?.user?.id && r.emoji === '👏') ? 'text-accent' : 'text-gray-400 hover:text-accent'}`}
                >
                  👏
                </button>
                <button 
                  onClick={() => setViewingReactions(post)}
                  className="text-[8px] font-bold text-gray-400 hover:text-accent transition-colors"
                >
                  {post.reactions?.filter((r: Reaction) => r.emoji === '👏').length || 0}
                </button>
              </div>
              <button 
                onClick={() => setCommentingOn(commentingOn === post.id ? null : post.id)}
                className="flex items-center gap-1 text-[10px] font-bold text-gray-400 hover:text-accent transition-colors"
              >
                <MessageSquare size={12} />
                <span className="text-[8px]">{post.comments?.length || 0}</span>
              </button>
            </div>

            {(post.comments?.length || 0) > 0 && (
              <div className="space-y-3 pl-4 border-l-2 border-border mt-4">
                {post.comments?.map((comment) => {
                  const isCommentMe = comment.user_id === session?.user?.id
                  return (
                    <div key={comment.id} className="space-y-1">
                      <div 
                        className={`flex items-center gap-2 group/commenter ${isCommentMe ? 'cursor-default' : 'cursor-pointer'}`}
                        onClick={() => !isCommentMe && comment.user_id && onSelectUser?.(comment.user_id)}
                      >
                        <div className={`w-4 h-4 bg-canvas border-2 border-border flex items-center justify-center text-[6px] font-bold text-accent uppercase overflow-hidden transition-colors ${!isCommentMe && 'group-hover/commenter:border-accent'}`}>
                          {comment.profiles?.avatar_url ? (
                            <img src={comment.profiles.avatar_url} alt={comment.profiles.username} className="w-full h-full object-cover" />
                          ) : (
                            comment.profiles?.username?.[0]
                          )}
                        </div>
                        <span className={`text-[9px] font-bold text-accent uppercase transition-colors ${!isCommentMe && 'group-hover/commenter:text-accent/80'}`}>{comment.profiles?.username}</span>
                        <span className="text-[7px] text-gray-400 font-bold uppercase">{formatDistanceToNow(new Date(comment.created_at))} ago</span>
                      </div>
                      <p className="text-[11px] text-gray-600 font-mono">{comment.content}</p>
                    </div>
                  )
                })}
              </div>
            )}

            {commentingOn === post.id && (
              <div className="flex gap-2 pt-2">
                <input
                  autoFocus
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder={t('feed.add_comment')}
                  className="flex-1 bg-canvas border-2 border-border px-3 py-1 text-[10px] font-mono text-ink focus:outline-none focus:border-accent"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddComment(post.id)}
                />
                <button 
                  onClick={() => handleAddComment(post.id)}
                  className="text-accent hover:text-accent/80 transition-colors"
                >
                  <Send size={14} />
                </button>
              </div>
            )}
          </div>
        )
      })}

        {posts.length === 0 && !loading && (
          <EmptyState 
            icon={Globe}
            title={t('feed.empty')}
            subtitle="The neural network is silent. Be the first to broadcast your achievements."
            action={session && dailyStreak > 0 ? {
              label: t('feed.share_streak'),
              onClick: onShareStreak
            } : undefined}
          />
        )}
      </div>

      {viewingReactions && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border-4 border-black w-full max-w-md shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-4 border-b-4 border-black flex justify-between items-center bg-accent text-white">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">REACTION_LOG</h3>
              <button 
                onClick={() => setViewingReactions(null)}
                className="p-1 hover:bg-white/20 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-4 custom-scrollbar">
              {(viewingReactions.reactions?.length || 0) > 0 ? (
                <div className="space-y-3">
                  {viewingReactions.reactions?.map((reaction) => (
                    <div key={reaction.id} className="flex items-center justify-between p-3 border-2 border-border bg-canvas hover:border-accent transition-all group">
                      <div 
                        className="flex items-center gap-3 cursor-pointer"
                        onClick={() => {
                          setViewingReactions(null)
                          onSelectUser?.(reaction.user_id)
                        }}
                      >
                        <div className="w-8 h-8 bg-white border-2 border-border flex items-center justify-center overflow-hidden">
                          {reaction.profiles?.avatar_url ? (
                            <img src={reaction.profiles.avatar_url} alt={reaction.profiles.username} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[10px] font-bold text-accent uppercase">{reaction.profiles?.username?.[0]}</span>
                          )}
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-tight text-ink group-hover:text-accent transition-colors">
                          @{reaction.profiles?.username}
                        </span>
                      </div>
                      <span className="text-xl">{reaction.emoji}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">No reactions recorded yet.</p>
                </div>
              )}
            </div>

            <div className="p-4 border-t-4 border-black bg-canvas">
              <button 
                onClick={() => setViewingReactions(null)}
                className="w-full py-3 bg-black text-white text-[10px] font-black uppercase tracking-[0.2em] hover:bg-accent transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
              >
                CLOSE_TRANSMISSION
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
