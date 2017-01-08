<template>
  <div>
    <mu-appbar title="Trickline">
      <mu-icon-button icon='menu' slot="left" />
    </mu-appbar>

    <mu-drawer :open="true" :docked="true">
      <h2>Hello.</h2>
    </mu-drawer>
  </div>
</template>

<script lang="ts">
export default {
  name: 'slack-client'
}
</script>
