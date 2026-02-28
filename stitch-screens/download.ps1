$outDir = "C:\Users\Admin\Desktop\Projects\Portfolio\WayfareAI\stitch-screens"

$images = @(
    @{ url = "https://lh3.googleusercontent.com/aida/AOfcidUeVhDOWLHWfuJqi7Im59xjT5XwnjtNUP3XvWj67NTVSa3mImNNpNZhooIjBkRE-5xC6m2a2mp_pIqBpwDONdl7gc7_5uI8awrvW11szS4TbLY_ujeYcZpHZfw1zfqRfBrMcCLfZOO4AjJLbIrWUlVvcRx3-55XV5Uhz3xfZ8C5Va_tTAviseib1i82xdzSolHwgq8o8du_zxUI26F6zsNzDc0mKZcSgrkgrTWLs1_UQ2fXkac"; file = "booking-flights-hotels.webp" }
    @{ url = "https://lh3.googleusercontent.com/aida/AOfcidWigztneB99srPsiM941XTTtrIO7hjHTNzkWs2QxxRYnphDqvVY_KJtePkHDselFmAIaIe4z2uKGSDe7QNFPFPUDLSt0gJutqCHncSu5KhXJ5vhECxhN8zpSVd6qrsMmzPtFEhdDBg5REzzB1eQ1joey9n-5xrdQfykd5AoC2owwUSJNoB-I6n4WgZ_UmYRRIgILDR0LWBN5oR5sfdAPQpp62hFcAYnJg9i1Huj9PZVEfziOT29YHjVmf0"; file = "my-bookings-overview.webp" }
    @{ url = "https://lh3.googleusercontent.com/aida/AOfcidXMNrrACdFKcZRP0Ym2vT8X7m5fNVCW4cw5xmLtvJXfqW89pLLHWBW4CT9TZNUaazGRt0-X0wnaEIi1jov17IyloGoZ4Cw77dIGknWbSHbj1RpJs7FTEdU6NnJYH6k2mcOO__We9pNGNiDM-hx5XVNK_n-7Z33ureUzFd5EzxL5Mkh2AbwHi7vySKAeEfTbGmezGuZts3tdi5NWhB9n_KhnCdVmjiqdngfzNc3h4g2YvX52Xp9aRdMqcQ"; file = "planner-empty-state.webp" }
    @{ url = "https://lh3.googleusercontent.com/aida/AOfcidXJzx992AxWsmGFp0M1cvIJ_OEd7aCmEIWtFTwTE9CU4mkzPadyQjw6GN17dnqwWXdVjdU8NmDWwNpDZ1cKu7BrcgxpAlaFxZDbXVywkDivyPZEfa4gDEru2WF8ns6qm2gAhu6n8ybKO_42Roc1GCuFZAcHn7oPtaXLm47Aw3y9HyOf0LALpaoY0jUuWHksDGB57Ktc3d1FkC2FCzNgJvSCvLuncef6r3DRbJNlr10zevR_RhermiJvdqY"; file = "wayfare-ai-planner.webp" }
    @{ url = "https://lh3.googleusercontent.com/aida/AOfcidXoMgsp6A4FOzGGS35V-s7C0YKGMWW8w9kDw9UqqPfkWz8B6V-W4B7utQIDgbyfU4XgKGNcScBG156WBEwbhOojhCHHZusFUF94oIX_9VcCTQ6YBHurUNUjkyAsYo7k3kR7ArVAROBlr56vvay5dqSH0s6lBfxEq7fbyT1NqzgE5bXq1KGzL7nm3epKzHkABJb3_6Chw118HhCrI-ROykxv_Cq9fxUk8sY1thBP_O7WjUbn3QIA2oCHHA"; file = "trip-expenses-breakdown.webp" }
    @{ url = "https://lh3.googleusercontent.com/aida/AOfcidXfwkprcTH3mIJE9e-v9cgYJ7AYA6ifB1aMVaXPcEOFmqGmJk4LBT6bboMU4m-cv8QLFI7y3z35c59y1cCoSMMVv4E1_do_V_14MRGD6uBZCGfqeRMaGh2tvIR07VWqjXqrsB0SoX8S5KezrMoTGxBNOkQx9_rQSd0LUnQT6ds4N4tPKeW_WPDRISEwxZFXRTmSXTopC4qZqGRz7mhtmXc1yMkAdlyrK3Z8BeQ5ujlCSp5BoelOczwU3Ks"; file = "detailed-trip-itinerary.webp" }
    @{ url = "https://lh3.googleusercontent.com/aida/AOfcidV7hosjsnUgrh4MZazvH_CMC4gR8Gta5GeIb11eu00hOXmBccBqZXVwagcAIM4RH6oRm7rSlMwYrFRZrzIRLYJUJlQ5DJD8-YYcD5XL0NFKrNvTep3vBECuz_Es1_SmfXK5HJImxU7Uc0jBADs-L3kRboJWGzMgU5_K4DqguE8dw2h2QwncSKN-j2do6RgPdacdFU90uU_rX_qPtnBfJZTs8ru-t_EAVgZaFWrrPkJmOg6i76ZYW2e7quw"; file = "mobile-planner-view.webp" }
    @{ url = "https://lh3.googleusercontent.com/aida/AOfcidVjuWs6LukR4EVCzDGRzDvJ-R4ESZwfSgt5usB1q3csND47fCX-A_khmiUzlL6hi4pvv52xl-yxcsdJKYm_VJhDV3xM9LWWKkEIdLWSqpzLKUAn791QuuepWz1Nl2mVcnAsu2x-k5L81AeDp8w5r0fRkPb81hvzLXi6n-7jBt4Gz6tGTdnJ1mXZ-tWlyQW38zuCFFtEme3v6OA9onUuYT0VRjQ4tKvQT_nq0gWCv1pT0TiO3xOlR7Lq_T0"; file = "swap-stop-modal.webp" }
)

$htmlFiles = @(
    @{ url = "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzk2ZGI5OTZiNzZiMTRkMmFiYmNhZGYxMjdjMDE0NzBiEgsSBxC_ydDUyQoYAZIBIwoKcHJvamVjdF9pZBIVQhM0ODUxOTgwNTQ2NDg2NzU3NzE1&filename=&opi=89354086"; file = "booking-flights-hotels.html" }
    @{ url = "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sX2IzNjk5OWVjZWQ5MzQyMzI5N2U2OTJhY2ZlMTA4Nzc1EgsSBxC_ydDUyQoYAZIBIwoKcHJvamVjdF9pZBIVQhM0ODUxOTgwNTQ2NDg2NzU3NzE1&filename=&opi=89354086"; file = "my-bookings-overview.html" }
    @{ url = "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzM0ZmU4MGI3MmRmZTRkZGI4M2YxMGIzYjM4MTgyZjBkEgsSBxC_ydDUyQoYAZIBIwoKcHJvamVjdF9pZBIVQhM0ODUxOTgwNTQ2NDg2NzU3NzE1&filename=&opi=89354086"; file = "planner-empty-state.html" }
    @{ url = "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzMyM2U2OGU1Nzc5YzRmMTE5MWZkZWU4MDMzN2FlZDFmEgsSBxC_ydDUyQoYAZIBIwoKcHJvamVjdF9pZBIVQhM0ODUxOTgwNTQ2NDg2NzU3NzE1&filename=&opi=89354086"; file = "wayfare-ai-planner.html" }
    @{ url = "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzYzMGI1ZmM5OGI4ZDRmZjM4OGViZjU5MWU0ODVlZmI0EgsSBxC_ydDUyQoYAZIBIwoKcHJvamVjdF9pZBIVQhM0ODUxOTgwNTQ2NDg2NzU3NzE1&filename=&opi=89354086"; file = "trip-expenses-breakdown.html" }
    @{ url = "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sX2Q2NGVlNGIzYzc1ZTRkYjQ5OTM5MmRhZGNjOWM2ZTE0EgsSBxC_ydDUyQoYAZIBIwoKcHJvamVjdF9pZBIVQhM0ODUxOTgwNTQ2NDg2NzU3NzE1&filename=&opi=89354086"; file = "detailed-trip-itinerary.html" }
    @{ url = "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzEyYmZkZjBiMDkwNzRmNzg4NGRjYTExN2E3YjY5MmFiEgsSBxC_ydDUyQoYAZIBIwoKcHJvamVjdF9pZBIVQhM0ODUxOTgwNTQ2NDg2NzU3NzE1&filename=&opi=89354086"; file = "mobile-planner-view.html" }
    @{ url = "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzcxMWVkZjM1NmNhMjQ0MTlhNzllNmY5N2E5OWNhNWY2EgsSBxC_ydDUyQoYAZIBIwoKcHJvamVjdF9pZBIVQhM0ODUxOTgwNTQ2NDg2NzU3NzE1&filename=&opi=89354086"; file = "swap-stop-modal.html" }
)

Write-Host "=== Downloading Images ==="
foreach ($item in $images) {
    $dest = Join-Path $outDir $item.file
    Write-Host "Downloading $($item.file)..."
    Invoke-WebRequest -Uri $item.url -OutFile $dest -UseBasicParsing
    Write-Host "  -> Saved: $dest"
}

Write-Host ""
Write-Host "=== Downloading HTML Code ==="
foreach ($item in $htmlFiles) {
    $dest = Join-Path $outDir $item.file
    Write-Host "Downloading $($item.file)..."
    Invoke-WebRequest -Uri $item.url -OutFile $dest -UseBasicParsing
    Write-Host "  -> Saved: $dest"
}

Write-Host ""
Write-Host "All done!"
