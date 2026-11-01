# Kotlin 2.3 return-value checker metadata is not read at runtime.
# https://github.com/Kotlin/KEEP/blob/main/proposals/KEEP-0412-unused-return-value-checker.md
-dontwarn kotlin.MustUseReturnValues

# Local Release DEX lost PropertyDescriptor.fieldAnnotation and threw null before Record conversion.
# Keep runtime-proxy Record annotations (including validation), not all Record implementations.
# Supporting independent trace (Oct 28): https://github.com/expo/expo/issues/49081
-keep @interface expo.modules.kotlin.records.** { *; }
