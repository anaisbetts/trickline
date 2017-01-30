<template>
  <div class="content-container">
    <channel-list style="flex: 0 1 auto" />

    <div style="flex: 1 1 auto">
      <mu-appbar :zIndex="2" :zDepth="1" title="Trickline" class="appbar">
        <mu-icon-button icon='menu' slot="left"></mu-icon-button>
      </mu-appbar>

      <message-pane />
    </div>
  </div>
</template>

<script lang="js">
import MessagePane from './message-pane';
import ChannelList from './channel-list';

export default {
  name: 'tl-client',
  components: {
    MessagePane, ChannelList
  }
}
</script>