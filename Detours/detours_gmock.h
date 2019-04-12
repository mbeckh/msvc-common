/*
Copyright 2019 Michael Beckh

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http ://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

#pragma once

#include <gmock/gmock.h>

#include <detours.h>

#include <type_traits>

#define DTGM_ARG0
#define DTGM_ARG1 testing::_
#define DTGM_ARG2 testing::_, testing ::_
#define DTGM_ARG3 testing::_, testing::_, testing::_
#define DTGM_ARG4 testing::_, testing::_, testing::_, testing::_
#define DTGM_ARG5 testing::_, testing::_, testing::_, testing::_, testing::_
#define DTGM_ARG6 testing::_, testing::_, testing::_, testing::_, testing::_, testing::_
#define DTGM_ARG7 testing::_, testing::_, testing::_, testing::_, testing::_, testing::_, testing::_
#define DTGM_ARG8 testing::_, testing::_, testing::_, testing::_, testing::_, testing::_, testing::_, testing::_
#define DTGM_ARG9 testing::_, testing::_, testing::_, testing::_, testing::_, testing::_, testing::_, testing::_, testing::_

#define DTGM_INTERNAL_ACTION0(function_) \
	__pragma(warning(suppress : 4100))   \
		ACTION(DTGM_Call##function_) {   \
		return DTGM_real##function_();   \
	}

#define DTGM_INTERNAL_ACTION1(function_)   \
	__pragma(warning(suppress : 4100))     \
		ACTION(DTGM_Call##function_) {     \
		return DTGM_real##function_(arg0); \
	}

#define DTGM_INTERNAL_ACTION2(function_)         \
	__pragma(warning(suppress : 4100))           \
		ACTION(DTGM_Call##function_) {           \
		return DTGM_real##function_(arg0, arg1); \
	}

#define DTGM_INTERNAL_ACTION3(function_)               \
	__pragma(warning(suppress : 4100))                 \
		ACTION(DTGM_Call##function_) {                 \
		return DTGM_real##function_(arg0, arg1, arg2); \
	}

#define DTGM_INTERNAL_ACTION4(function_)                     \
	__pragma(warning(suppress : 4100))                       \
		ACTION(DTGM_Call##function_) {                       \
		return DTGM_real##function_(arg0, arg1, arg2, arg3); \
	}

#define DTGM_INTERNAL_ACTION5(function_)                           \
	__pragma(warning(suppress : 4100))                             \
		ACTION(DTGM_Call##function_) {                             \
		return DTGM_real##function_(arg0, arg1, arg2, arg3, arg4); \
	}

#define DTGM_INTERNAL_ACTION6(function_)                                 \
	__pragma(warning(suppress : 4100))                                   \
		ACTION(DTGM_Call##function_) {                                   \
		return DTGM_real##function_(arg0, arg1, arg2, arg3, arg4, arg5); \
	}

#define DTGM_INTERNAL_ACTION7(function_)                                       \
	__pragma(warning(suppress : 4100))                                         \
		ACTION(DTGM_Call##function_) {                                         \
		return DTGM_real##function_(arg0, arg1, arg2, arg3, arg4, arg5, arg6); \
	}

#define DTGM_INTERNAL_ACTION8(function_)                                             \
	__pragma(warning(suppress : 4100))                                               \
		ACTION(DTGM_Call##function_) {                                               \
		return DTGM_real##function_(arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7); \
	}

#define DTGM_INTERNAL_ACTION9(function_)                                                   \
	__pragma(warning(suppress : 4100))                                                     \
		ACTION(DTGM_Call##function_) {                                                     \
		return DTGM_real##function_(arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8); \
	}

#define DTGM_INTERNAL_DEFINE_MOCK_METHOD(parameterCount_, return_, callType_, function_, parameters_, arguments_, default_) \
	MOCK_METHOD##parameterCount_##_WITH_CALLTYPE(callType_, function_, return_##parameters_)

#define DTGM_INTERNAL_DEFINE_FUNCTIONS(parameterCount_, return_, callType_, function_, parameters_, arguments_, default_) \
	static return_(callType_* DTGM_real##function_)##parameters_ = function_;                                             \
	DTGM_INTERNAL_ACTION##parameterCount_(function_);                                                                     \
	return_ callType_ DTGM_My##function_##parameters_ {                                                                   \
		return g_pApiMock->function_##arguments_;                                                                         \
	}

#define DTGM_INTERNAL_SET_DEFAULT_ACTION(parameterCount_, return_, callType_, function_, parameters_, arguments_, default_) \
	do {                                                                                                                    \
		auto lambda = default_;                                                                                             \
		if (std::is_null_pointer_v<decltype(lambda)>) {                                                                     \
			ON_CALL(*g_pApiMock, function_(DTGM_ARG##parameterCount_)).WillByDefault(DTGM_Call##function_());               \
			EXPECT_CALL(*g_pApiMock, function_(DTGM_ARG##parameterCount_)).Times(testing::AnyNumber());                     \
		} else {                                                                                                            \
			ON_CALL(*g_pApiMock, function_(DTGM_ARG##parameterCount_)).WillByDefault(default_);                             \
		}                                                                                                                   \
	} while (0)

#define DTGM_INTERNAL_ATTACH(parameterCount_, return_, callType_, function_, parameters_, arguments_, default_) \
	ASSERT_EQ(NO_ERROR, DetourAttach(&(void*&) DTGM_real##function_, DTGM_My##function_))

#define DTGM_INTERNAL_DETACH(parameterCount_, return_, callType_, function_, parameters_, arguments_, default_) \
	ASSERT_EQ(NO_ERROR, DetourDetach(&(void*&) DTGM_real##function_, DTGM_My##function_))

#define DTGM_DECLARE_API_MOCK(name_, functions_)                         \
	namespace detours_gmock##name_ {                                     \
		namespace {                                                      \
		class DTGM_ApiMock;                                              \
		void DTGM_Setup();                                               \
		static DTGM_ApiMock* g_pApiMock;                                 \
		class DTGM_ApiMock {                                             \
		public:                                                          \
			DTGM_ApiMock() {                                             \
				g_pApiMock = this;                                       \
				DTGM_Setup();                                            \
			}                                                            \
			functions_(DTGM_INTERNAL_DEFINE_MOCK_METHOD);                \
		};                                                               \
		functions_(DTGM_INTERNAL_DEFINE_FUNCTIONS);                      \
		void DTGM_Setup() {                                              \
			functions_(DTGM_INTERNAL_SET_DEFAULT_ACTION);                \
			ASSERT_EQ(NO_ERROR, DetourTransactionBegin());               \
			ASSERT_EQ(NO_ERROR, DetourUpdateThread(GetCurrentThread())); \
			functions_(DTGM_INTERNAL_ATTACH);                            \
			ASSERT_EQ(NO_ERROR, DetourTransactionCommit());              \
		}                                                                \
		void DTGM_Detach() {                                             \
			ASSERT_EQ(NO_ERROR, DetourTransactionBegin());               \
			ASSERT_EQ(NO_ERROR, DetourUpdateThread(GetCurrentThread())); \
			functions_(DTGM_INTERNAL_DETACH);                            \
			ASSERT_EQ(NO_ERROR, DetourTransactionCommit());              \
		}                                                                \
		}                                                                \
	}

#define DTGM_DEFINE_API_MOCK(name_, var_) \
	detours_gmock##name_::DTGM_ApiMock var_;

#define DTGM_DETACH_API_MOCK(name_) \
	detours_gmock##name_::DTGM_Detach()

#define DTGM_REAL(name_, function_) \
	detours_gmock##name_::DTGM_real##function_

namespace detours_gmock {

#pragma warning(suppress : 4100)
ACTION_P(SetLastError, lastError_) {
	::SetLastError(lastError_);
}

#pragma warning(suppress : 4100)
ACTION_P2(SetLastErrorAndReturn, lastError_, value_) {
	::SetLastError(lastError_);
	return value_;
}

}  // namespace detours_gmock
