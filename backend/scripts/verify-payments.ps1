# Synthetic manual verification of the payment flow against a running dev server.
# Prints statuses and ids only. Never prints tokens or secrets.

$ErrorActionPreference = 'Stop'
$base = 'http://localhost:3000/api/v1'
$compose = "$PSScriptRoot\..\..\infra\docker\docker-compose.dev.yml"

$envLines = Get-Content "$PSScriptRoot\..\.env"
$secret = ($envLines | Select-String '^PAYMENT_WEBHOOK_SECRET=').ToString().Substring(23).Trim()
$code = [int](($envLines | Select-String '^MOCK_NAFATH_CODE=').ToString().Substring(17))

# Windows PowerShell 5.1 throws on non-2xx, so the error body is read back off
# the exception rather than with -SkipHttpErrorCheck.
function Invoke-Api($method, $path, $raw, $headers) {
  try {
    $res = Invoke-WebRequest -Method $method -Uri "$base$path" -Body $raw `
      -ContentType 'application/json' -Headers $headers -UseBasicParsing
    return @{ status = [int]$res.StatusCode; body = ($res.Content | ConvertFrom-Json) }
  } catch [System.Net.WebException] {
    $response = $_.Exception.Response
    if (-not $response) { return @{ status = -1; body = $null } }
    # Invoke-WebRequest has already drained the response stream, so the body is
    # only reachable through ErrorDetails.
    $content = $_.ErrorDetails.Message
    $parsed = if ($content) { $content | ConvertFrom-Json } else { $null }
    return @{ status = [int]$response.StatusCode; body = $parsed }
  }
}

function Body($hash) { $hash | ConvertTo-Json -Compress }

# Windows PowerShell 5.1's `-UFormat %s` reports a local-time epoch, which the
# webhook's freshness window correctly rejects, so use a true UTC epoch.
function Epoch { [DateTimeOffset]::UtcNow.ToUnixTimeSeconds() }

function Sign($raw) {
  $t = Epoch
  $hmac = New-Object System.Security.Cryptography.HMACSHA256
  $hmac.Key = [Text.Encoding]::UTF8.GetBytes($secret)
  $hash = $hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes("$t.$raw"))
  return "t=$t,v1=$((($hash | ForEach-Object { $_.ToString('x2') }) -join ''))"
}

function Sql($query) {
  return (docker compose -f $compose exec -T postgres psql -U sjs -d sjs_dev -t -A -c $query).Trim()
}

$nationalId = "1$((Get-Date).Ticks.ToString().Substring(9,9))"
$login = Invoke-Api POST '/auth/nafath/verify' (Body @{ nationalId = $nationalId; nafathCode = $code }) @{}
$auth = @{ Authorization = "Bearer $($login.body.data.accessToken)" }
Write-Host "1.  login                       -> $($login.status)"

$from = (Get-Date).ToUniversalTime().ToString('o')
$to = (Get-Date).ToUniversalTime().AddDays(14).ToString('o')
$lawyers = Invoke-Api GET '/lawyers?limit=50' $null $auth

# The dev database also holds lawyers left behind by e2e runs whose windows sit
# in 2030, so pick the first one with a bookable block inside the real window.
$slots = $null
foreach ($candidate in $lawyers.body.data) {
  $found = Invoke-Api GET "/lawyers/$($candidate.id)/availability?from=$from&to=$to" $null $auth
  if ($found.body.data.Count -gt 0) { $lawyerId = $candidate.id; $slots = $found; break }
}
$scheduledAt = $slots.body.data[0].startAt
Write-Host "2.  availability                -> $($slots.status) slots=$($slots.body.data.Count)"

$booking = Invoke-Api POST '/consultations' (Body @{ lawyerId = $lawyerId; scheduledAt = $scheduledAt; type = 'INSTANT' }) $auth
$consultationId = $booking.body.data.id
Write-Host "3.  book consultation           -> $($booking.status) status=$($booking.body.data.status)"

$summary = Invoke-Api GET "/payments/summary/$consultationId" $null $auth
$s = $summary.body.data
Write-Host "4.  payment summary             -> $($summary.status) original=$($s.original.amount) discountPct=$($s.discountPct) payable=$($s.payable.amount) $($s.payable.currency)"

$key = [guid]::NewGuid().ToString()
$idem = $auth.Clone(); $idem['Idempotency-Key'] = $key
$initBody = Body @{ consultationId = $consultationId; method = 'MADA' }
$init = Invoke-Api POST '/payments/initiate' $initBody $idem
$paymentId = $init.body.data.id
Write-Host "5.  initiate payment            -> $($init.status) status=$($init.body.data.status) payable=$($init.body.data.payable.amount)"
Write-Host "    exposes transactionId?      -> $([bool]($init.body.data.PSObject.Properties.Name -contains 'transactionId'))"

$replay = Invoke-Api POST '/payments/initiate' $initBody $idem
Write-Host "6.  same idempotency key        -> $($replay.status) samePayment=$($replay.body.data.id -eq $paymentId)"

$conflict = Invoke-Api POST '/payments/initiate' $initBody $auth
Write-Host "7.  second live intent          -> $($conflict.status) code=$($conflict.body.error.code)"

$tampered = Invoke-Api POST '/payments/initiate' (Body @{ consultationId = $consultationId; method = 'MADA'; amount = 1; currency = 'USD' }) $auth
Write-Host "8.  client-supplied amount      -> $($tampered.status) code=$($tampered.body.error.code)"

$detail = Invoke-Api GET "/payments/$paymentId" $null $auth
Write-Host "9.  payment detail              -> $($detail.status) status=$($detail.body.data.status)"

# Only the gateway knows the provider reference, so it is read from the database
# the way a real provider would echo it back on the callback.
$txnId = Sql "SELECT \`"transactionId\`" FROM \`"Payment\`" WHERE id = '$paymentId';"
$amountMinor = [int](Sql "SELECT (amount * 100)::int FROM \`"Payment\`" WHERE id = '$paymentId';")

$event = Body @{ eventId = "evt_$([guid]::NewGuid())"; type = 'payment.succeeded'; paymentId = $paymentId
                 transactionId = $txnId; amountMinor = $amountMinor; currency = 'SAR' }

$unsigned = Invoke-Api POST '/payments/webhook' $event @{}
Write-Host "10. unsigned webhook            -> $($unsigned.status) code=$($unsigned.body.error.code)"

$forged = Invoke-Api POST '/payments/webhook' $event @{ 'x-payment-signature' = "t=$(Epoch),v1=$('0' * 64)" }
Write-Host "11. forged signature            -> $($forged.status) code=$($forged.body.error.code)"

$wrongAmount = Body @{ eventId = "evt_$([guid]::NewGuid())"; type = 'payment.succeeded'; paymentId = $paymentId
                       transactionId = $txnId; amountMinor = 1; currency = 'SAR' }
$mismatch = Invoke-Api POST '/payments/webhook' $wrongAmount @{ 'x-payment-signature' = (Sign $wrongAmount) }
Write-Host "12. wrong amount                -> $($mismatch.status) code=$($mismatch.body.error.code)"

$signed = Invoke-Api POST '/payments/webhook' $event @{ 'x-payment-signature' = (Sign $event) }
Write-Host "13. verified webhook            -> $($signed.status) status=$($signed.body.data.status) duplicate=$($signed.body.data.duplicate)"

$replayHook = Invoke-Api POST '/payments/webhook' $event @{ 'x-payment-signature' = (Sign $event) }
Write-Host "14. replayed webhook            -> $($replayHook.status) status=$($replayHook.body.data.status) duplicate=$($replayHook.body.data.duplicate)"

$paid = Invoke-Api GET "/payments/$paymentId" $null $auth
$after = Invoke-Api GET "/consultations/$consultationId" $null $auth
Write-Host "15. payment after webhook       -> $($paid.body.data.status)"
Write-Host "16. consultation after webhook  -> $($after.body.data.status)"

$otherId = "1$((Get-Date).Ticks.ToString().Substring(8,9))"
$other = Invoke-Api POST '/auth/nafath/verify' (Body @{ nationalId = $otherId; nafathCode = $code }) @{}
$otherAuth = @{ Authorization = "Bearer $($other.body.data.accessToken)" }
$idor = Invoke-Api GET "/payments/$paymentId" $null $otherAuth
$missing = Invoke-Api GET '/payments/pay_does_not_exist' $null $otherAuth
Write-Host "17. IDOR other citizen          -> $($idor.status) code=$($idor.body.error.code)"
Write-Host "18. unknown payment             -> $($missing.status) code=$($missing.body.error.code) identical=$($idor.body.error.code -eq $missing.body.error.code)"

$noAuth = Invoke-Api GET "/payments/$paymentId" $null @{}
Write-Host "19. no JWT                      -> $($noAuth.status)"

$auditKeys = Sql "SELECT string_agg(DISTINCT k, ',') FROM \`"AuditLog\`", jsonb_object_keys(metadata) AS k WHERE \`"resourceId\`" = '$paymentId';"
Write-Host "20. audit metadata keys         -> $auditKeys"
