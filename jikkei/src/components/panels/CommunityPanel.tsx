

export function CommunityPanel() {
  const posts = [
    { user: 'OPERATOR_99', action: 'published', target: 'Ghost Protocol Ch.3', time: '2m ago', tag: 'STORY' },
    { user: 'NULL_ECHO', action: 'shared character', target: 'MIRA_9 v2.1', time: '14m ago', tag: 'CHARACTER' },
    { user: 'SABLE_X', action: 'completed', target: 'Neon Shatter — True End', time: '1h ago', tag: 'MILESTONE' },
    { user: 'REI_VOID', action: 'uploaded world', target: 'District Zero', time: '3h ago', tag: 'WORLD' },
    { user: 'ATLAS_00', action: 'rated 5★', target: 'Analog Dreams', time: '5h ago', tag: 'REVIEW' },
  ]
  return (
    <div className="panel-content">
      <div className="panel-header">
        <span className="panel-eyebrow">// LIVE_FEED</span>
        <h2 className="panel-title">COMMUNITY</h2>
      </div>
      <div className="feed">
        {posts.map((p, i) => (
          <div key={i} className="feed-item">
            <div className="feed-avatar">{p.user[0]}</div>
            <div className="feed-body">
              <p className="feed-text">
                <span className="feed-user">{p.user}</span>
                <span className="feed-action"> {p.action} </span>
                <span className="feed-target">"{p.target}"</span>
              </p>
              <p className="feed-time">{p.time}</p>
            </div>
            <span className="feed-tag">{p.tag}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
