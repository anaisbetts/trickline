export type EventType =
  'message' |
  'ping' |
  'typing' |
  'tickle' | // used to indicate any user activity is occurring besides typing

  'bot_added' |
  'bot_changed' |
  'bot_removed' |

  'group_joined' |
  'group_close' |
  'group_open' |
  'group_left' |
  'group_archive' |
  'group_unarchive' |
  'group_rename' |
  'group_marked' |
  'group_history_changed' |
  'group_converted_to_shared' |
  'mpim_joined' | // special snowflake for MPDMs that are actually represented as groups
  'mpim_history_changed' |

  'channel_joined' |
  'channel_created' |
  'channel_deleted' |
  'channel_left' |
  'channel_archive' |
  'channel_unarchive' |
  'channel_rename' |
  'channel_marked' |
  'channel_history_changed' |
  'channel_converted_to_shared' |
  'user_read_only_channels' | // contains all read only public/private channels

  'file_created' |
  'file_deleted' |
  'file_shared' |
  'file_unshared' |
  'file_public' |
  'file_comment_added' |
  'file_comment_deleted' |
  'file_comment_edited' |
  'file_change' |

  'im_created' |
  'im_close' |
  'im_open' |
  'im_marked' |
  'im_history_changed' |

  'star_added' |
  'star_removed' |

  'reaction_added' |
  'reaction_removed' |

  'pong' |
  'hello' |
  'user_typing' |
  'error' | // indicates an error message returned by the MS
  'reconnect_url' | // a message the specify a fast reconnect URL
  'pref_change' |
  'team_pref_change' |
  'user_change' |
  'presence_change' |
  'emoji_changed' |

  'pin_added' |
  'pin_removed' |

  'subteam_self_added' | // we refer to these as User Groups
  'subteam_self_removed' | // but the MS events are still called `subteam_*`
  'subteam_created' |
  'subteam_updated' |

  // calls (screenhero)
  // these are for initiating/ cancelling calls
  'screenhero_invite' |
  'screenhero_invite_response' |
  'screenhero_invite_cancel' |

  // not meant to be rendered in a channel, but to update the client room model.
  'sh_room_join' |
  'sh_room_leave' |
  'sh_room_update' |

  'dnd_updated' | // logged in user's info changes
  'dnd_updated_user' | // anyone else on the team's info changes

  'team_profile_change' |
  'team_profile_delete' |
  'team_profile_reorder' |

  // teams
  'team_join' |
  'team_domain_change' | // the team domain is changed
  'team_rename' | // team name changed
  'user_added_to_team' | // the logged in user is added to another team in the same enterprise
  'user_removed_from_team' | // the logged in user is removed from a team in the current enterprise

  // enterprise
  'teams_joined_shared_channel' | // a team in an enterprise is added to a shared channel
  'enterprise_domain_change' | // the enterprise domain is changed
  'enterprise_rename' | // the enterprise name is changed

  'commands_changed' |

  'thread_subscribed' |
  'thread_unsubscribed' |
  'update_thread_state' |
  'thread_marked' |
  'UNKNOWN';

export type EventSubType =
  'message_changed' |
  'message_deleted' |
  'message_replied' |
  'channel_join' |
  'channel_leave' |
  'channel_topic' |
  'channel_name' |
  'channel_purpose' |
  'channel_archive' |
  'channel_unarchive' |
  'group_join' |
  'group_leave' |
  'group_topic' |
  'group_name' |
  'group_purpose' |
  'group_archive' |
  'group_unarchive' |
  'mpim_notify_disabled' |
  'file_share' |
  'file_mention' |
  'file_comment' |
  'bot_message' |
  'me_message' |
  'bot_add' |
  'bot_remove' |
  'bot_disable' |
  'bot_enable' |
  'pinned_item' |
  'sh_room_created' |
  'sh_room_shared' |
  'tombstone' |
  'reply_broadcast' |
  'reminder_add' |
  'reminder_delete' |
  'NO_SUBTYPE';
