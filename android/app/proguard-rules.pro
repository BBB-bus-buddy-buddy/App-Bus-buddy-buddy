# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# ============================================
# Google Play Services (Location)
# ============================================
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.android.gms.**
-keepclassmembers class com.google.android.gms.** { *; }

# ============================================
# React Native Community Geolocation
# ============================================
-keep class com.reactnativecommunity.geolocation.** { *; }
-keepclassmembers class com.reactnativecommunity.geolocation.** { *; }

# ============================================
# React Native Permissions
# ============================================
-keep class com.zoontek.rnpermissions.** { *; }
-keepclassmembers class com.zoontek.rnpermissions.** { *; }

# ============================================
# Location Services General
# ============================================
-keep class android.location.** { *; }
-keepclassmembers class android.location.** { *; }
