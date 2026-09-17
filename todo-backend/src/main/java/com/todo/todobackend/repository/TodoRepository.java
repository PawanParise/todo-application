package com.todo.todobackend.repository;

import com.todo.todobackend.model.Todo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface TodoRepository extends JpaRepository<Todo, Long> {

    @Query("SELECT t FROM Todo t WHERE t.user.id = :userId ORDER BY t.id DESC")
    List<Todo> findByUserIdOrderByIdDesc(@Param("userId") Long userId);

    @Query("SELECT t FROM Todo t WHERE t.user.id = :userId")
    List<Todo> findByUserId(@Param("userId") Long userId);

    @Query("SELECT t FROM Todo t WHERE t.id = :id AND t.user.id = :userId")
    Optional<Todo> findByIdAndUserId(@Param("id") Long id, @Param("userId") Long userId);

    @Query("SELECT t FROM Todo t JOIN FETCH t.user u WHERE t.completed = false AND t.reminderEmail = true AND (t.reminderSent = false OR t.reminderSent IS NULL) AND t.reminderDateTime IS NOT NULL AND t.reminderDateTime <= :now")
    List<Todo> findPendingEmailReminders(@Param("now") java.time.LocalDateTime now);
}

