<template>
  <div>
    <h2>Hello from {{text}}</h2>
    <mu-raised-button label="This is a button"></mu-raised-button>
    <mu-checkbox label="Foo">Ripple Effect</mu-checkbox>
  </div>
</template>

<script lang="ts">
export default {
  name: 'test',
  props: ['text']
}
</script>