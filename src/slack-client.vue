<template>
  <div>
    <div class="content-container">
      <mu-appbar :zIndex="2" :zDepth="1" title="Trickline" class="appbar">
        <mu-icon-button icon='menu' slot="left"></mu-icon-button>
      </mu-appbar>
      <p class="content">
        <h2>Hello world.</h2>
      </p>
    </content>

    <mu-drawer :zIndex="1" :zDepth="1" :open="true" :docked="docked">
      <h2>Hello.</h2>
    </mu-drawer>
  </div>
</template>

<script lang="ts">
export default {
  name: 'slack-client'
}
</script>


<style lang="less">
.appbar{
  position: fixed;
  left: 256px;
  right: 0;
  top: 0;
  width: auto;
  transition: all .45s;

  &.nav-hide {
    left: 0;
  }
}
.content{
  padding-top: 56px;
  padding-left: 256px;
  transition: all .45s;
  &.nav-hide {
    padding-left: 0;
  }
}

.content-wrapper{
  padding: 48px 72px;
}

@media (min-width: 480px) {
  .content{
    padding-top: 64px;
  }
}

@media (max-width: 993px) {
  .appbar {
    left: 0;
  }
  .content{
    padding-left: 0;
  }
  .content-wrapper {
    padding: 24px 36px;
  }
}
</style>