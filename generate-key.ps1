# REFLEXA — Admin Key Generator
# الاستخدام: .\generate-key.ps1 -Email "your@email.com" -Plan "pro-monthly"
# الخطط المتاحة: pro-monthly, pro-annual, enterprise

param(
    [string]$Email = "hanodeking15@gmail.com",
    [string]$Plan  = "pro-annual"  # افتراضي: سنوي مجاني لك
)

$secret  = "RxFlx_LS_Wh00k_S3cr3t_2025!"
$orderId = "admin-$(Get-Date -Format 'yyyyMMddHHmmss')"

$body = @{
    data = @{
        id = $orderId
        attributes = @{
            user_email   = $Email
            product_name = if ($Plan -eq "pro-annual") { "REFLEXA Pro Annual" } else { "REFLEXA Pro Monthly" }
            variant_name = if ($Plan -eq "pro-annual") { "Annual" } else { "Monthly" }
        }
    }
} | ConvertTo-Json -Depth 5 -Compress

# احسب التوقيع
$hmac = New-Object System.Security.Cryptography.HMACSHA256
$hmac.Key = [System.Text.Encoding]::UTF8.GetBytes($secret)
$sig = ($hmac.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($body)) | ForEach-Object { $_.ToString("x2") }) -join ""

$headers = @{
    "Content-Type" = "application/json"
    "X-Event-Name" = "order_created"
    "X-Signature"  = $sig
}

Write-Host "`n🔑 Generating REFLEXA Pro key for: $Email" -ForegroundColor Cyan
Write-Host "   Plan: $Plan`n" -ForegroundColor Gray

try {
    $result = Invoke-RestMethod -Uri "https://reflexa-license.hanodeking15.workers.dev/webhook/lemonsqueezy" -Method POST -Headers $headers -Body $body

    if ($result.ok) {
        Write-Host "✅ Key generated successfully!" -ForegroundColor Green
        Write-Host "   License Key: $($result.key)" -ForegroundColor Yellow
        Write-Host "   Email sent : $($result.emailSent)" -ForegroundColor Gray
        Write-Host "`n📋 Copy your key:" -ForegroundColor Cyan
        Write-Host "   $($result.key)`n" -ForegroundColor White

        # نسخ للـ clipboard تلقائياً
        $result.key | Set-Clipboard
        Write-Host "✓ Key copied to clipboard!" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed: $($result | ConvertTo-Json)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
}
