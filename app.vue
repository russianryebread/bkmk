<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup lang="ts">
const { init } = useDarkMode()

onMounted(() => {
  init()
})
</script>
