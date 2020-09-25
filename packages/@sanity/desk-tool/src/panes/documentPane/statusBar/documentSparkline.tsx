/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable react/no-multi-comp */
/* eslint-disable react/no-array-index-key */

import React from 'react'
import SyncIcon from 'part:@sanity/base/sync-icon'
import {useSyncState} from '@sanity/react-hooks'
import Button from 'part:@sanity/components/buttons/default'
import {ChunkType} from '@sanity/field/lib/diff'
import {useDocumentHistory} from '../documentHistory'
import TimeAgo from '../../../components/TimeAgo'
import {HistoryIcon, LiveIcon, PublishIcon} from '../../../badges/icons'
import {getTimelineEventIconComponent, formatTimelineEventLabel} from '../timeline/helpers'
import styles from './documentSparkline.css'
import {Badge} from './types'
import {SESSION_BADGE_SIZE, SESSION_BADGE_MARGIN, MAX_SESSIONS} from './constants'
import {DocumentBadges} from './documentBadges'
import {usePrevious} from './hooks'

const SESSION_BADGE_STYLE: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  transform: 'translate(0, 0, 0)'
}

interface SessionBadge extends Badge {
  type?: 'live' | ChunkType
  style?: React.CSSProperties
}

const SessionBadge = ({icon, title, type, style = {}}: SessionBadge) => {
  const iconComponent =
    type && type !== 'live' ? getTimelineEventIconComponent(type) || <code>{type}</code> : icon
  return (
    <div className={styles.badge} data-type={type} title={title} style={style}>
      <span className={styles.icon}>{React.createElement(icon || iconComponent)}</span>
      <span className={`${styles.icon} ${styles.hoverIcon}`}>
        <HistoryIcon />
      </span>
    </div>
  )
}

interface DocumentSparklineProps {
  badges: Badge[]
  lastUpdated: string | undefined | null
  editState: any
  type: string | undefined
}

export function DocumentSparkline({type, badges, lastUpdated, editState}: DocumentSparklineProps) {
  const [transitionDirection, setTransitionDirection] = React.useState<'in' | 'out' | ''>('')
  const {open: openHistory, historyController, timeline} = useDocumentHistory()
  const showingRevision = historyController.onOlderRevision()
  const syncState = useSyncState(timeline?.publishedId)
  const isLiveDocument = type === 'live'

  const chunks = timeline.mapChunks(chunk => chunk)
  // Find the first unpublish or publish event and use it as the base event if it exists
  const lastUnpublishOrPublishSession = chunks.find(
    chunk => chunk.type === 'unpublish' || chunk.type === 'publish'
  )

  // Make sure we only show editDraft sessions (and count the unpublish as a draft session)
  const filteredSessions = lastUnpublishOrPublishSession
    ? chunks.filter(
        session =>
          (session.type === 'editDraft' || session.type === 'unpublish') &&
          session.index >= lastUnpublishOrPublishSession.index
      )
    : chunks.filter(session => session.type === 'editDraft')

  // Track the amount of sessions for the transition to work
  const prevSessionsCount = usePrevious(filteredSessions.length)

  React.useEffect(() => {
    // If we have more sessions than before, transition the changes button in
    if (filteredSessions.length > prevSessionsCount) {
      setTransitionDirection('in')
    }
    // If we have less sessions than before, or if there are no longer any draft sessions
    // transition the changes button out
    if (prevSessionsCount > filteredSessions.length && filteredSessions.length === 0) {
      setTransitionDirection('out')
    }
    // Reset the transition after 0.8s
    const animateTimer = setTimeout(() => {
      setTransitionDirection('')
    }, 800)
    return () => {
      clearTimeout(animateTimer)
    }
  }, [filteredSessions.length, prevSessionsCount])

  // Only show a max number of edit sessions in the sessions button
  const sessionsSliced = filteredSessions.slice(0, MAX_SESSIONS).reverse()

  // To enable transitions with position absolute and translate3d
  // give the session container the correct width based on amount of sessions
  const sessionContainerWidth =
    syncState?.isSyncing || sessionsSliced.length === 1
      ? SESSION_BADGE_SIZE
      : sessionsSliced.length * SESSION_BADGE_MARGIN + SESSION_BADGE_SIZE - SESSION_BADGE_MARGIN

  // Only show a published session badge if the base event was a publish event
  // and we don't have a live document
  const showPublishedSessionBadge =
    lastUnpublishOrPublishSession?.type === 'publish' && !isLiveDocument

  return (
    <div className={styles.root} data-disabled={showingRevision}>
      {showPublishedSessionBadge && (
        <div className={styles.primarySessionBadgeContainer}>
          <SessionBadge
            type="publish"
            icon={PublishIcon}
            title={formatTimelineEventLabel('publish')}
          />
          <div className={styles.statusDetails}>
            <div className={styles.label}>Published</div>
            {lastUnpublishOrPublishSession?.endTimestamp && (
              <TimeAgo time={lastUnpublishOrPublishSession.endTimestamp} />
            )}
          </div>
        </div>
      )}

      {isLiveDocument && (
        <div className={styles.primarySessionBadgeContainer}>
          <SessionBadge type="live" title="Live document" icon={LiveIcon} />
          <div className={styles.statusDetails}>
            <div className={styles.label}>Published</div>
            {lastUpdated && <TimeAgo time={lastUpdated} />}
          </div>
        </div>
      )}

      {!isLiveDocument && (
        <Button
          kind="simple"
          padding="small"
          onClick={openHistory}
          type="button"
          disabled={showingRevision}
          className={styles.reviewChangesButton}
          data-syncing={syncState.isSyncing}
          title="Review changes"
          data-transition={filteredSessions.length === 0 ? 'out' : transitionDirection}
        >
          <div className={styles.inner}>
            <div
              className={styles.sessionBadges}
              style={{minWidth: sessionContainerWidth}}
              data-syncing={syncState.isSyncing}
            >
              {sessionsSliced.map((session, i) => {
                const spacing = i * SESSION_BADGE_MARGIN
                const title = formatTimelineEventLabel(session.type) || session.type
                const icon = syncState?.isSyncing ? SyncIcon : undefined
                return (
                  <SessionBadge
                    key={session.index}
                    title={title}
                    type="editDraft" // always use editDraft
                    icon={icon}
                    style={{
                      ...SESSION_BADGE_STYLE,
                      transform: syncState?.isSyncing
                        ? `translate3d(0, 0, 0)`
                        : `translate3d(${spacing}px, 0, 0)`
                    }}
                  />
                )
              })}
            </div>
            <div className={styles.statusDetails}>
              <div className={styles.label}>Changes</div>
              {lastUpdated && <TimeAgo time={lastUpdated} />}
            </div>
          </div>
        </Button>
      )}
      <div
        className={styles.documentBadgesContainer}
        style={{
          // TODO: hacky solution. Should probably be fixed.
          transform:
            filteredSessions.length > 0 ? `translate3d(0, 0, 0)` : `translate3d(-100px, 0, 0)`
        }}
      >
        <DocumentBadges editState={editState} badges={badges} />
      </div>
    </div>
  )
}