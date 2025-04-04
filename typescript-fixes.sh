#!/bin/bash

# Fix leave/route.ts errors
sed -i '' 's/catch (error) {/catch {/' src/app/api/leave/route.ts
sed -i '' 's/catch (error: any) {/catch (error: Error | unknown) {/' src/app/api/leave/route.ts
sed -i '' 's/{ error: error.message || /{ error: error instanceof Error ? error.message : /' src/app/api/leave/route.ts

# Fix users/[id]/route.ts errors
sed -i '' 's/catch (error) {/catch {/' src/app/api/users/[id]/route.ts
sed -i '' 's/catch (error: any) {/catch (error: Error | unknown) {/' src/app/api/users/[id]/route.ts
sed -i '' 's/{ error: error.message || /{ error: error instanceof Error ? error.message : /' src/app/api/users/[id]/route.ts

# Mark unused variables with underscores
sed -i '' 's/const userId = /const _userId = /' src/app/api/leave/route.ts
sed -i '' 's/const isAdmin = /const _isAdmin = /' src/app/api/leave/route.ts
