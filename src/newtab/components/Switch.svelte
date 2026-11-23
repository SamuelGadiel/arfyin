<script lang="ts">
  interface Props {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label?: string;
  }
  let { checked, onChange, label }: Props = $props();
</script>

<label class="switch-row">
  {#if label}<span class="label">{label}</span>{/if}
  <button
    type="button"
    class="switch"
    class:on={checked}
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onclick={() => onChange(!checked)}
  >
    <span class="thumb"></span>
  </button>
</label>

<style>
  .switch-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    cursor: pointer;
  }
  .label {
    font-size: 12px;
    opacity: 0.85;
  }
  .switch {
    flex-shrink: 0;
    position: relative;
    width: 36px;
    height: 20px;
    padding: 2px;
    background: rgba(255, 255, 255, 0.15);
    border: none;
    border-radius: 999px;
    cursor: pointer;
    transition: background 0.15s ease;
  }
  .switch.on {
    background: #7fd1a3;
  }
  .thumb {
    display: block;
    width: 16px;
    height: 16px;
    background: #fff;
    border-radius: 50%;
    transform: translateX(0);
    transition: transform 0.15s ease;
  }
  .switch.on .thumb {
    transform: translateX(16px);
  }
</style>
