import { EventType, EventSubType } from './event-type';
import { Api } from './api-call';

export interface ChannelBase {
  id: string;
  name: string;
  created: number;
  last_read: string;
  latest: string;
  is_starred: boolean;

  // shared channels
  is_shared: boolean;
  is_org_shared: boolean;
  shares?: Array<string>;
  shared_team_ids?: Array<string>;
  unread_count?: number;
  unread_count_display?: number;
  mention_count?: number;
  dm_count?: number;

  api: Api;
}

export interface UsersCounts {
  channels: Array<Channel>;
  groups: Array<Group>;
  ims: Array<DirectMessage>;
}

export interface DirectMessage extends ChannelBase {
  user: string;
  is_open: boolean;
}

export interface Group extends ChannelBase {
  is_group: boolean;
}

export interface Channel extends ChannelBase {
  creator: string;
  is_member: boolean;
  is_general: boolean;
  is_archived: boolean;
  is_open: boolean;
  members: Array<string>;
  topic: { value: string, creator: string, last_set: string };
  purpose: { value: string, creator: string, last_set: string };
}

export interface EnterpriseUser {
  enterprise_id: string;
  id: string;
  teams: Array<string>;
}

export interface Icon {
  emoji?: string;
  image_34?: string;
  image_44?: string;
  image_68?: string;
  image_88?: string;
  image_102?: string;
  image_132?: string;
  image_original?: string;
  image_default: boolean;
};

export interface Message {
  // common for every message type
  type: EventType;
  subtype: EventSubType;
  hidden: boolean;
  ts: string;
  channel: string;

  /**
   * Ts of message that this message has a reference to
   *
   * Currently not recognized by server and only set locally via factory method newEphemeralMessage;
   * only used in NonMemberMentionPostHelper so that ephemeral invite message has a reference
   * to the message that originally had non-member mentions if user decides
   * to share archive link
   */
  associated_msg_ts?: string;

  // bot messages
  bot_id: string;
  icons: Icon;
  mrkdwn: boolean;

  ephemeral_msg_type: number; // based on EphemeralMsgType.id

  user?: string; // nullable userId
  username: string;
  topic: string;
  purpose: string;
  name: string;
  old_name: string;

  upload: boolean;
  file: File;
  comment: Comment;
  is_starred: boolean;

  edited: Message;

  // deleted message
  deleted_ts: string;
  text: string;

  //attachments?: Array<Attachment>; // nullable

  inviter: string;

  // replies
  thread_ts: string;
  parent_user_id: string;
  reply_count: number;

  //reactions: Array<Reaction>;

  item_type: string;
  //item: Item;

  // shared channels
  user_profile: SharedUserProfile;
  source_team: string;

  subscribed: boolean;

  //replies: Array<Reply>;

  last_read: string;

  is_ephemeral: boolean;

  api: Api;
}

export interface Profile {
  first_name: string;
  last_name: string;
  full_name: string;
  preferred_name: string;
  current_status: string;
  status_emoji: string;
  status_text: string;
  phone: string;
  real_name: string;
  real_name_normalized: string;
  full_name_normalized: string;
  preferred_name_normalized: string;
  email: string;
  title: string;
  avatar_hash: string;
  always_active: boolean;
  bot_id: string;
  fields: { [name: string]: UserProfileField };

  image_24: string;
  image_32: string;
  image_48: string;
  image_72: string;
  image_192: string;
}

export interface SharedUserProfile {
  avatar_hash: string;
  image_72: string;
  first_name: string;
  real_name: string;
  name: string;
  is_restricted: boolean;
  is_ultra_restricted: boolean;
}

export interface TeamProfileField {
  id: string;
  ordering: number;
  label: string;
  hint: string;
  type: string;
  possible_values: Array<string>;
  is_hidden: boolean;
}

export interface Team {
  id: string;
  enterprise_id: string;
  name: string;
  email_domain: string;
  domain: string;
  avatar_base_url: string;
  has_compliance_export: boolean;
  prefs: TeamPrefs;
  icon: Icon;
  profile: TeamProfile;
  plan: string;
  description: string;
  discoverable: string;
  api: Api;
};

export interface TeamPrefs {
  msg_edit_window_mins: number;
  display_real_names: boolean;
  allow_message_deletion: boolean;
  invites_only_admins: boolean;
  who_can_at_everyone: string;
  who_can_at_channel: string;
  who_can_create_channels: string;
  who_can_archive_channels: string;
  who_can_create_groups: string;
  who_can_post_general: string;
  who_can_kick_channels: string;
  who_can_kick_groups: string;
  compliance_export_start: number;
  dnd_enabled: boolean;
  dnd_start_hour: string;
  dnd_end_hour: string;
  disable_file_uploads: string;
  allow_calls: boolean;
  require_at_for_mention: boolean;
  warn_before_at_channel: string;
  custom_status_presets: Array<Array<string>>;
  custom_status_default_emoji: string;
};

export interface TeamProfile {
  fields: Array<TeamProfileField>;
}

export interface User {
  id: string;
  name: string;
  deleted: boolean;
  icons: Icon;

  presence: string;
  color: string;
  tz: string;
  tz_label: string;
  tz_offset: number;
  team_id: string;
  is_admin: boolean;
  is_owner: boolean;
  is_primary_owner: boolean;
  is_restricted: boolean;
  is_ultra_restricted: boolean;
  is_bot: boolean;
  has_files: boolean;
  enterprise_user: EnterpriseUser;
  profile: Profile;
  api: Api;
}

export interface UserProfileField {
  value: string;
  alt: string;
}